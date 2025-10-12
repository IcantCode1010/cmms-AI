package com.grash.service;

import com.grash.configuration.AgentProperties;
import com.grash.dto.agent.AgentChatResponse;
import com.grash.dto.agent.AgentDraftActionResponse;
import com.grash.dto.agent.AgentPromptRequest;
import com.grash.dto.agent.AgentRuntimeDraft;
import com.grash.dto.agent.AgentRuntimeRequest;
import com.grash.dto.agent.AgentRuntimeResponse;
import com.grash.dto.agent.AgentRuntimeToolCall;
import com.grash.exception.AgentRuntimeException;
import com.grash.model.AgentDraftAction;
import com.grash.model.AgentToolInvocationLog;
import com.grash.model.OwnUser;
import com.grash.repository.AgentDraftActionRepository;
import com.grash.repository.AgentToolInvocationLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentService {

    private final AgentProperties agentProperties;
    private final AgentToolInvocationLogRepository invocationLogRepository;
    private final AgentToolRegistry agentToolRegistry;
    private final AgentRuntimeClient agentRuntimeClient;
    private final AgentDraftActionRepository draftActionRepository;

    public AgentChatResponse handlePrompt(OwnUser user, AgentPromptRequest request, String authorizationHeader) {
        String effectiveAgentId = Optional.ofNullable(request.getAgentId())
                .filter(id -> !id.isEmpty())
                .orElse(agentProperties.getChatkitAgentId());

        String correlationId = generateCorrelationId();

        if (!StringUtils.hasText(agentProperties.getRuntimeUrl())) {
            log.warn("Agent runtime URL not configured. Returning not_ready response. correlationId={}", correlationId);
            return AgentChatResponse.notReady(effectiveAgentId, correlationId);
        }

        Map<String, Object> metadata = new HashMap<>();
        if (request.getMetadata() != null) {
            metadata.putAll(request.getMetadata());
        }
        metadata.put("userContext", agentToolRegistry.getUserContext(user));
        metadata.put("correlationId", correlationId);

        AgentToolInvocationLog promptLog = createPromptLog(user, correlationId, metadata);

        AgentRuntimeRequest runtimeRequest = AgentRuntimeRequest.builder()
                .agentId(effectiveAgentId)
                .prompt(request.getPrompt())
                .metadata(metadata)
                .user(agentToolRegistry.getUserContext(user))
                .build();

        try {
            AgentRuntimeResponse runtimeResponse = agentRuntimeClient.sendPrompt(runtimeRequest, correlationId, authorizationHeader);
            promptLog.setStatus("completed");
            promptLog.setResultCount(runtimeResponse.getMessages() != null ? runtimeResponse.getMessages().size() : null);
            invocationLogRepository.save(promptLog);

            persistToolCalls(runtimeResponse.getToolCalls(), user, correlationId);
            List<AgentDraftActionResponse> drafts = persistDrafts(runtimeResponse.getDrafts(),
                    runtimeResponse.getSessionId(), user);

            log.info("Agent runtime responded for correlation {}", correlationId);
            return AgentChatResponse.fromRuntime(correlationId, runtimeResponse, drafts);
        } catch (AgentRuntimeException exception) {
            promptLog.setStatus("failed");
            invocationLogRepository.save(promptLog);
            log.error("Failed to process agent prompt correlationId={}", correlationId, exception);
            return AgentChatResponse.error(effectiveAgentId, correlationId,
                    "Failed to contact agent runtime. Please try again later.");
        }
    }

    private AgentToolInvocationLog createPromptLog(OwnUser user,
                                                   String correlationId,
                                                   Map<String, Object> metadata) {
        AgentToolInvocationLog logEntry = new AgentToolInvocationLog();
        logEntry.setUserId(user != null ? user.getId() : null);
        logEntry.setCompanyId(user != null && user.getCompany() != null ? user.getCompany().getId() : null);
        logEntry.setToolName("chat_prompt");
        logEntry.setStatus("queued");
        logEntry.setCorrelationId(correlationId);
        logEntry.setArgumentsJson(agentToolRegistry.serializeArguments(metadata));
        return invocationLogRepository.save(logEntry);
    }

    private void persistToolCalls(List<AgentRuntimeToolCall> toolCalls,
                                  OwnUser user,
                                  String correlationId) {
        if (CollectionUtils.isEmpty(toolCalls)) {
            return;
        }
        toolCalls.forEach(call -> {
            AgentToolInvocationLog logEntry = new AgentToolInvocationLog();
            logEntry.setToolName(call.getToolName());
            logEntry.setArgumentsJson(agentToolRegistry.serializeArguments(call.getArguments()));
            logEntry.setResultCount(call.getResultCount());
            logEntry.setStatus(call.getStatus());
            logEntry.setCorrelationId(correlationId);
            if (user != null) {
                logEntry.setUserId(user.getId());
                if (user.getCompany() != null) {
                    logEntry.setCompanyId(user.getCompany().getId());
                }
            }
            invocationLogRepository.save(logEntry);
        });
    }

    private List<AgentDraftActionResponse> persistDrafts(List<AgentRuntimeDraft> runtimeDrafts,
                                                         String sessionId,
                                                         OwnUser user) {
        if (CollectionUtils.isEmpty(runtimeDrafts)) {
            return new ArrayList<>();
        }
        return runtimeDrafts.stream()
                .map(draft -> {
                    AgentDraftAction action = new AgentDraftAction();
                    if (user != null) {
                        action.setUserId(user.getId());
                        if (user.getCompany() != null) {
                            action.setCompanyId(user.getCompany().getId());
                        }
                    }
                    action.setAgentSessionId(
                            StringUtils.hasText(draft.getAgentSessionId()) ? draft.getAgentSessionId() : sessionId);
                    action.setOperationType(draft.getOperationType());
                    String payloadJson = agentToolRegistry.serializeArguments(buildDraftPayload(draft));
                    action.setPayload(StringUtils.hasText(payloadJson) ? payloadJson : "{}");
                    action.setStatus("pending");
                    AgentDraftAction saved = draftActionRepository.save(action);
                    return AgentDraftActionResponse.builder()
                            .id(saved.getId())
                            .agentSessionId(saved.getAgentSessionId())
                            .operationType(saved.getOperationType())
                            .payload(saved.getPayload())
                            .status(saved.getStatus())
                            .createdAt(saved.getCreatedAt())
                            .updatedAt(saved.getUpdatedAt())
                            .build();
                })
                .collect(Collectors.toList());
    }

    private Map<String, Object> buildDraftPayload(AgentRuntimeDraft draft) {
        Map<String, Object> payload = new HashMap<>();
        String summary = StringUtils.hasText(draft.getSummary())
                ? draft.getSummary()
                : "Agent proposed action requires confirmation";
        payload.put("summary", summary);
        payload.put("data", draft.getPayload() != null ? draft.getPayload() : Collections.emptyMap());
        return payload;
    }

    public String generateCorrelationId() {
        return UUID.randomUUID().toString();
    }
}
