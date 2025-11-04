package com.grash.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.grash.dto.agent.AgentDraftActionResponse;
import com.grash.dto.agent.AgentWorkOrderCreateRequest;
import com.grash.dto.agent.AgentWorkOrderStatusUpdateRequest;
import com.grash.dto.workOrder.WorkOrderPostDTO;
import com.grash.exception.CustomException;
import com.grash.model.AgentDraftAction;
import com.grash.model.OwnUser;
import com.grash.model.WorkOrder;
import com.grash.model.Asset;
import com.grash.model.Location;
import com.grash.model.Team;
import com.grash.model.WorkOrderCategory;
import com.grash.model.enums.Priority;
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
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.Objects;
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
            case "create_work_order":
                applyCreateWorkOrderDraft(draftAction, user);
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

        // Handle status transition: OPEN → IN_PROGRESS → COMPLETE
        Status currentStatus = workOrder.getStatus();
        if (Status.OPEN.equals(currentStatus)) {
            // First transition to IN_PROGRESS
            AgentWorkOrderStatusUpdateRequest progressRequest = new AgentWorkOrderStatusUpdateRequest();
            progressRequest.setWorkOrderId(workOrderIdentifier);
            progressRequest.setNewStatus(Status.IN_PROGRESS.name());
            progressRequest.setNotes("Started via agent");
            agentToolService.updateWorkOrderStatus(user, progressRequest);
        }

        // Then transition to COMPLETE
        AgentWorkOrderStatusUpdateRequest completeRequest = new AgentWorkOrderStatusUpdateRequest();
        completeRequest.setWorkOrderId(workOrderIdentifier);
        completeRequest.setNewStatus(Status.COMPLETE.name());
        completeRequest.setNotes("Completed via agent");

        agentToolService.updateWorkOrderStatus(user, completeRequest);

        markPayloadApplied(draftAction, payload, "Work order marked as complete.");
    }

    private void applyCreateWorkOrderDraft(AgentDraftAction draftAction, OwnUser user) {
        Map<String, Object> payload = readPayload(draftAction.getPayload());
        Map<String, Object> dataSection = extractDataSection(payload);
        if (dataSection == null || dataSection.isEmpty()) {
            throw new CustomException("Draft payload missing data for work order creation", HttpStatus.BAD_REQUEST);
        }
        AgentWorkOrderCreateRequest request;
        try {
            request = objectMapper.convertValue(dataSection, AgentWorkOrderCreateRequest.class);
        } catch (IllegalArgumentException exception) {
            log.warn("Failed to deserialize work order creation payload", exception);
            throw new CustomException("Invalid draft payload", HttpStatus.BAD_REQUEST);
        }
        if (!StringUtils.hasText(request.getTitle())) {
            throw new CustomException("Draft payload missing title", HttpStatus.BAD_REQUEST);
        }

        WorkOrderPostDTO workOrder = buildWorkOrderFromCreateRequest(request, user);
        WorkOrder createdWorkOrder = workOrderService.create(workOrder, user.getCompany());
        markCreationPayloadApplied(draftAction, payload, request, createdWorkOrder);
    }

    private WorkOrderPostDTO buildWorkOrderFromCreateRequest(AgentWorkOrderCreateRequest request, OwnUser user) {
        WorkOrderPostDTO workOrder = new WorkOrderPostDTO();
        workOrder.setTitle(request.getTitle().trim());
        if (StringUtils.hasText(request.getDescription())) {
            workOrder.setDescription(request.getDescription().trim());
        }
        if (StringUtils.hasText(request.getPriority())) {
            workOrder.setPriority(Priority.getPriorityFromString(request.getPriority()));
        }
        Date dueDate = parseDateValue(request.getDueDate());
        if (dueDate != null) {
            workOrder.setDueDate(dueDate);
        }
        Date estimatedStartDate = parseDateValue(request.getEstimatedStartDate());
        if (estimatedStartDate != null) {
            workOrder.setEstimatedStartDate(estimatedStartDate);
        }
        if (request.getEstimatedDurationHours() != null) {
            workOrder.setEstimatedDuration(request.getEstimatedDurationHours());
        }
        if (request.getRequireSignature() != null) {
            workOrder.setRequiredSignature(request.getRequireSignature());
        }

        if (request.getLocationId() != null) {
            workOrder.setLocation(referenceLocation(request.getLocationId()));
        }
        if (request.getAssetId() != null) {
            workOrder.setAsset(referenceAsset(request.getAssetId()));
        }
        if (request.getTeamId() != null) {
            workOrder.setTeam(referenceTeam(request.getTeamId()));
        }
        if (request.getPrimaryUserId() != null) {
            workOrder.setPrimaryUser(referenceUser(request.getPrimaryUserId()));
        }
        if (request.getAssignedUserIds() != null && !request.getAssignedUserIds().isEmpty()) {
            List<OwnUser> assigned = request.getAssignedUserIds().stream()
                    .filter(Objects::nonNull)
                    .map(this::referenceUser)
                    .collect(Collectors.toCollection(ArrayList::new));
            workOrder.setAssignedTo(assigned);
        }
        if (request.getCategoryId() != null) {
            workOrder.setCategory(referenceCategory(request.getCategoryId()));
        }

        workOrder.setCompany(user.getCompany());
        workOrder.setCreatedBy(user.getId());
        workOrder.setStatus(Status.OPEN);
        return workOrder;
    }

    private Location referenceLocation(Long locationId) {
        Location location = new Location();
        location.setId(locationId);
        return location;
    }

    private Asset referenceAsset(Long assetId) {
        Asset asset = new Asset();
        asset.setId(assetId);
        return asset;
    }

    private Team referenceTeam(Long teamId) {
        Team team = new Team();
        team.setId(teamId);
        return team;
    }

    private WorkOrderCategory referenceCategory(Long categoryId) {
        WorkOrderCategory category = new WorkOrderCategory();
        category.setId(categoryId);
        return category;
    }

    private OwnUser referenceUser(Long userId) {
        OwnUser reference = new OwnUser();
        reference.setId(userId);
        return reference;
    }

    private Map<String, Object> extractDataSection(Map<String, Object> payload) {
        if (payload == null) {
            return Collections.emptyMap();
        }
        Object dataNode = payload.get("data");
        if (dataNode instanceof Map<?, ?>) {
            @SuppressWarnings("unchecked")
            Map<String, Object> casted = (Map<String, Object>) dataNode;
            return new HashMap<>(casted);
        }
        Map<String, Object> fallback = new HashMap<>(payload);
        fallback.remove("summary");
        fallback.remove("result");
        fallback.remove("appliedAt");
        return fallback;
    }

    private Date parseDateValue(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        String trimmed = value.trim();
        try {
            return Date.from(Instant.parse(trimmed));
        } catch (DateTimeParseException instantException) {
            try {
                OffsetDateTime offsetDateTime = OffsetDateTime.parse(trimmed);
                return Date.from(offsetDateTime.toInstant());
            } catch (DateTimeParseException offsetException) {
                try {
                    LocalDate localDate = LocalDate.parse(trimmed);
                    return Date.from(localDate.atStartOfDay(ZoneOffset.UTC).toInstant());
                } catch (DateTimeParseException localDateException) {
                    throw new CustomException("Invalid date format: " + trimmed, HttpStatus.BAD_REQUEST);
                }
            }
        }
    }

    private void markCreationPayloadApplied(AgentDraftAction draftAction,
                                            Map<String, Object> payload,
                                            AgentWorkOrderCreateRequest request,
                                            WorkOrder createdWorkOrder) {
        Map<String, Object> updatedPayload = payload == null ? new HashMap<>() : new HashMap<>(payload);
        Map<String, Object> data = new HashMap<>(extractDataSection(updatedPayload));
        data.put("workOrderId", createdWorkOrder.getId());
        data.put("workOrderCode", createdWorkOrder.getCustomId());
        data.put("status", createdWorkOrder.getStatus() != null ? createdWorkOrder.getStatus().name() : Status.OPEN.name());
        updatedPayload.put("data", data);
        updatedPayload.put("result", "Work order created.");
        updatedPayload.put("appliedAt", Instant.now().toString());
        if (StringUtils.hasText(request.getSummary())) {
            updatedPayload.put("summary", request.getSummary().trim());
        }
        try {
            draftAction.setPayload(objectMapper.writeValueAsString(updatedPayload));
        } catch (JsonProcessingException exception) {
            log.warn("Failed to serialize updated draft payload", exception);
        }
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
        // Check root level first
        if (payload.containsKey("workOrderId")) {
            return payload.get("workOrderId");
        }
        // Check nested data object (handles wrapped payload structure)
        Object dataNode = payload.get("data");
        if (dataNode instanceof Map<?, ?>) {
            Map<?, ?> dataMap = (Map<?, ?>) dataNode;
            if (dataMap.containsKey("workOrderId")) {
                return dataMap.get("workOrderId");
            }
        }
        // Fallback: check for id field variations
        if (payload.containsKey("id")) {
            return payload.get("id");
        }
        if (dataNode instanceof Map<?, ?>) {
            Map<?, ?> dataMap = (Map<?, ?>) dataNode;
            if (dataMap.containsKey("id")) {
                return dataMap.get("id");
            }
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



