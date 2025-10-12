package com.grash.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grash.configuration.AgentProperties;
import com.grash.dto.agent.AgentChatMessage;
import com.grash.dto.agent.AgentChatResponse;
import com.grash.dto.agent.AgentPromptRequest;
import com.grash.dto.agent.AgentRuntimeDraft;
import com.grash.dto.agent.AgentRuntimeResponse;
import com.grash.dto.agent.AgentRuntimeToolCall;
import com.grash.model.AgentDraftAction;
import com.grash.model.AgentToolInvocationLog;
import com.grash.model.Company;
import com.grash.model.OwnUser;
import com.grash.model.Role;
import com.grash.repository.AgentDraftActionRepository;
import com.grash.repository.AgentToolInvocationLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeast;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentServiceTest {

    @Mock
    private AgentProperties agentProperties;
    @Mock
    private AgentToolInvocationLogRepository logRepository;
    @Mock
    private AgentRuntimeClient runtimeClient;
    @Mock
    private AgentDraftActionRepository draftActionRepository;

    private AgentToolRegistry agentToolRegistry;
    private AgentService agentService;

    @BeforeEach
    void setUp() {
        agentToolRegistry = new AgentToolRegistry(new ObjectMapper());
        agentService = new AgentService(agentProperties, logRepository, agentToolRegistry, runtimeClient, draftActionRepository);
    }

    @Test
    void returnsNotReadyWhenRuntimeUrlMissing() {
        AgentPromptRequest request = new AgentPromptRequest();
        request.setPrompt("Test prompt");
        request.setMetadata(new HashMap<>());

        when(agentProperties.getChatkitAgentId()).thenReturn("default-agent");
        when(agentProperties.getRuntimeUrl()).thenReturn("");

        AgentChatResponse response = agentService.handlePrompt(null, request, null);

        assertThat(response.getStatus()).isEqualTo("not_ready");
        verify(runtimeClient, never()).sendPrompt(any(), anyString(), anyString());
    }

    @Test
    void persistsLogsAndDraftsOnSuccessfulRuntimeResponse() {
        AgentPromptRequest request = new AgentPromptRequest();
        request.setPrompt("Close the highest priority work order");
        request.setMetadata(new HashMap<>());

        OwnUser user = buildUser();

        when(agentProperties.getChatkitAgentId()).thenReturn("agent-123");
        when(agentProperties.getRuntimeUrl()).thenReturn("http://runtime");

        when(logRepository.save(any(AgentToolInvocationLog.class))).thenAnswer(invocation -> {
            AgentToolInvocationLog log = invocation.getArgument(0);
            if (log.getId() == null) {
                log.setId(1L);
            }
            return log;
        });

        when(draftActionRepository.save(any(AgentDraftAction.class))).thenAnswer(invocation -> {
            AgentDraftAction action = invocation.getArgument(0);
            action.setId(42L);
            return action;
        });

        AgentRuntimeResponse runtimeResponse = AgentRuntimeResponse.builder()
                .status("success")
                .message("ok")
                .agentId("agent-123")
                .sessionId("session-1")
                .messages(List.of(AgentChatMessage.builder().role("assistant").content("Stub response").build()))
                .toolCalls(List.of(AgentRuntimeToolCall.builder()
                        .toolName("view_work_orders")
                        .arguments(Map.of("status", "open"))
                        .resultCount(5)
                        .status("success")
                        .build()))
                .drafts(List.of(AgentRuntimeDraft.builder()
                        .agentSessionId("session-1")
                        .operationType("close_work_order")
                        .payload(Map.of("workOrderId", 101))
                        .summary("Close work order 101")
                        .build()))
                .build();

        when(runtimeClient.sendPrompt(any(), anyString(), anyString())).thenReturn(runtimeResponse);

        AgentChatResponse response = agentService.handlePrompt(user, request, "Bearer test-token");

        assertThat(response.getStatus()).isEqualTo("success");
        assertThat(response.getDrafts()).hasSize(1);
        assertThat(response.getMessages()).hasSize(1);

        verify(runtimeClient).sendPrompt(any(), anyString(), anyString());
        verify(logRepository, atLeast(2)).save(any(AgentToolInvocationLog.class));
        verify(draftActionRepository).save(any(AgentDraftAction.class));

        ArgumentCaptor<AgentDraftAction> draftCaptor = ArgumentCaptor.forClass(AgentDraftAction.class);
        verify(draftActionRepository).save(draftCaptor.capture());
        assertThat(draftCaptor.getValue().getPayload()).contains("workOrderId");
    }

    private OwnUser buildUser() {
        OwnUser user = new OwnUser();
        user.setId(7L);
        user.setFirstName("Ava");
        user.setLastName("Agent");
        user.setEmail("ava.agent@example.com");

        Role role = new Role();
        role.setName("ADMIN");
        user.setRole(role);

        Company company = new Company();
        company.setId(9L);
        user.setCompany(company);

        return user;
    }
}
