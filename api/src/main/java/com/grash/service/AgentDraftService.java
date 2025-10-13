package com.grash.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.grash.dto.agent.AgentDraftActionResponse;
import com.grash.dto.agent.AgentWorkOrderStatusUpdateRequest;
import com.grash.exception.CustomException;
import com.grash.model.AgentDraftAction;
import com.grash.model.OwnUser;
import com.grash.model.WorkOrder;
import com.grash.model.enums.Status;
import com.grash.repository.AgentDraftActionRepository;
import com.grash.utils.Helper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class AgentDraftService {

    private final AgentDraftActionRepository draftActionRepository;
    private final WorkOrderService workOrderService;
    private final AgentToolService agentToolService;
    private final ObjectMapper objectMapper;

    public List<AgentDraftActionResponse> getPendingDrafts(OwnUser user) {
        return draftActionRepository.findByUserIdAndStatus(user.getId(), "pending")
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public AgentDraftActionResponse confirmDraft(Long draftId, OwnUser user) {
        AgentDraftAction draftAction = draftActionRepository.findByIdAndUserId(draftId, user.getId())
                .orElseThrow(() -> new CustomException("Draft action not found", HttpStatus.NOT_FOUND));
        if (!"pending".equalsIgnoreCase(draftAction.getStatus())) {
            throw new CustomException("Draft action already processed", HttpStatus.CONFLICT);
        }
        try {
            applyDraftAction(draftAction, user);
            draftAction.setStatus("applied");
        } catch (CustomException exception) {
            draftAction.setStatus("failed");
            draftAction.setUpdatedAt(Instant.now());
            draftActionRepository.save(draftAction);
            throw exception;
        } catch (RuntimeException exception) {
            draftAction.setStatus("failed");
            draftAction.setUpdatedAt(Instant.now());
            draftActionRepository.save(draftAction);
            log.error("Unexpected error while applying draft action {}", draftAction.getOperationType(), exception);
            throw new CustomException("Failed to apply draft action", HttpStatus.INTERNAL_SERVER_ERROR);
        }
        draftAction.setUpdatedAt(Instant.now());
        return toResponse(draftActionRepository.save(draftAction));
    }

    @Transactional
    public AgentDraftActionResponse declineDraft(Long draftId, OwnUser user) {
        AgentDraftAction draftAction = draftActionRepository.findByIdAndUserId(draftId, user.getId())
                .orElseThrow(() -> new CustomException("Draft action not found", HttpStatus.NOT_FOUND));
        draftAction.setStatus("declined");
        draftAction.setUpdatedAt(Instant.now());
        return toResponse(draftActionRepository.save(draftAction));
    }

    private void applyDraftAction(AgentDraftAction draftAction, OwnUser user) {
        String operation = draftAction.getOperationType();
        if (!StringUtils.hasText(operation)) {
            throw new CustomException("Draft action missing operation type", HttpStatus.BAD_REQUEST);
        }
        switch (operation.toLowerCase()) {
            case "complete_work_order":
                applyCompleteWorkOrderDraft(draftAction, user);
                break;
            default:
                throw new CustomException("Unsupported draft operation: " + operation, HttpStatus.NOT_IMPLEMENTED);
        }
    }

    private void applyCompleteWorkOrderDraft(AgentDraftAction draftAction, OwnUser user) {
        Map<String, Object> payload = readPayload(draftAction.getPayload());
        String workOrderIdentifier = resolveWorkOrderIdentifier(payload);
        WorkOrder workOrder = resolveWorkOrder(workOrderIdentifier, user);

        if (Status.COMPLETE.equals(workOrder.getStatus())) {
            markPayloadApplied(draftAction, payload, "Work order already complete.");
            return;
        }

        AgentWorkOrderStatusUpdateRequest request = new AgentWorkOrderStatusUpdateRequest();
        request.setWorkOrderId(workOrderIdentifier);
        request.setNewStatus(Status.COMPLETE.name());

        agentToolService.updateWorkOrderStatus(user, request);

        markPayloadApplied(draftAction, payload, "Work order marked as complete.");
    }

    private Map<String, Object> readPayload(String payloadJson) {
        if (!StringUtils.hasText(payloadJson)) {
            return new HashMap<>();
        }
        try {
            return objectMapper.readValue(payloadJson, new TypeReference<Map<String, Object>>() {
            });
        } catch (IOException exception) {
            log.warn("Failed to parse agent draft payload", exception);
            throw new CustomException("Invalid draft payload", HttpStatus.BAD_REQUEST);
        }
    }

    private String resolveWorkOrderIdentifier(Map<String, Object> payload) {
        Object identifier = extractWorkOrderIdentifier(payload);
        if (identifier == null) {
            throw new CustomException("Draft payload missing workOrderId", HttpStatus.BAD_REQUEST);
        }
        String normalized = normalizeIdentifier(identifier);
        if (!StringUtils.hasText(normalized)) {
            throw new CustomException("Draft payload missing workOrderId", HttpStatus.BAD_REQUEST);
        }
        return normalized;
    }

    private String normalizeIdentifier(Object identifier) {
        if (identifier instanceof Number) {
            return String.valueOf(((Number) identifier).longValue());
        }
        if (identifier instanceof String) {
            String value = ((String) identifier).trim();
            return StringUtils.hasText(value) ? value : null;
        }
        return null;
    }

    private WorkOrder resolveWorkOrder(String identifier, OwnUser user) {
        Long companyId = user.getCompany().getId();
        Optional<WorkOrder> optional = Optional.empty();
        if (Helper.isNumeric(identifier)) {
            try {
                Long workOrderId = Long.parseLong(identifier.trim());
                optional = workOrderService.findByIdAndCompany(workOrderId, companyId);
            } catch (NumberFormatException exception) {
                log.debug("Draft identifier {} not parsable as numeric id", identifier);
            }
            if (optional.isPresent()) {
                return optional.get();
            }
        }
        optional = workOrderService.findByCustomIdIgnoreCaseAndCompany(identifier.trim(), companyId);
        return optional.orElseThrow(() -> new CustomException("Work order not found", HttpStatus.NOT_FOUND));
    }

    private Object extractWorkOrderIdentifier(Map<String, Object> payload) {
        if (payload == null || payload.isEmpty()) {
            return null;
        }
        if (payload.containsKey("workOrderId")) {
            return payload.get("workOrderId");
        }
        Object dataNode = payload.get("data");
        if (dataNode instanceof Map<?, ?>) {
            Map<?, ?> dataMap = (Map<?, ?>) dataNode;
            return dataMap.get("workOrderId");
        }
        return null;
    }

    private void markPayloadApplied(AgentDraftAction draftAction, Map<String, Object> payload, String message) {
        Map<String, Object> updated = payload == null ? new HashMap<>() : new HashMap<>(payload);
        updated.put("appliedAt", Instant.now().toString());
        if (StringUtils.hasText(message)) {
            updated.put("result", message);
        }
        try {
            draftAction.setPayload(objectMapper.writeValueAsString(updated));
        } catch (JsonProcessingException exception) {
            log.warn("Failed to serialize updated draft payload", exception);
        }
    }

    private AgentDraftActionResponse toResponse(AgentDraftAction action) {
        return AgentDraftActionResponse.builder()
                .id(action.getId())
                .agentSessionId(action.getAgentSessionId())
                .operationType(action.getOperationType())
                .payload(action.getPayload())
                .status(action.getStatus())
                .createdAt(action.getCreatedAt())
                .updatedAt(action.getUpdatedAt())
                .build();
    }
}



