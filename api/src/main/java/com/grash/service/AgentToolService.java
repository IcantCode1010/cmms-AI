package com.grash.service;

import com.grash.advancedsearch.FilterField;
import com.grash.advancedsearch.SearchCriteria;
import com.grash.advancedsearch.SpecificationBuilder;
import com.grash.dto.agent.AgentAssetSearchRequest;
import com.grash.dto.agent.AgentAssetSummary;
import com.grash.dto.agent.AgentToolResponse;
import com.grash.dto.agent.AgentWorkOrderCreateRequest;
import com.grash.dto.agent.AgentWorkOrderCreateResponse;
import com.grash.dto.agent.AgentWorkOrderStatusUpdateRequest;
import com.grash.dto.agent.AgentWorkOrderStatusUpdateResponse;
import com.grash.dto.agent.AgentWorkOrderSearchRequest;
import com.grash.dto.agent.AgentWorkOrderSummary;
import com.grash.dto.agent.AgentWorkOrderUpdateRequest;
import com.grash.dto.agent.AgentWorkOrderUpdateResponse;
import com.grash.dto.workOrder.WorkOrderPostDTO;
import com.grash.exception.CustomException;
import com.grash.model.Asset;
import com.grash.model.File;
import com.grash.model.Labor;
import com.grash.model.Location;
import com.grash.model.Notification;
import com.grash.model.OwnUser;
import com.grash.model.Task;
import com.grash.model.Team;
import com.grash.model.WorkOrder;
import com.grash.model.WorkOrderCategory;
import com.grash.model.WorkOrderHistory;
import com.grash.model.enums.AssetStatus;
import com.grash.model.enums.EnumName;
import com.grash.model.enums.NotificationType;
import com.grash.model.enums.Priority;
import com.grash.model.enums.RoleCode;
import com.grash.model.enums.Status;
import com.grash.model.enums.TimeStatus;
import com.grash.repository.AssetRepository;
import com.grash.repository.WorkOrderRepository;
import com.grash.utils.Helper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Date;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AgentToolService {
    private static final int DEFAULT_LIMIT = 5;
    private static final int MAX_LIMIT = 50;
    private static final Set<String> ALLOWED_ROLE_NAMES = Set.of("ADMIN", "MANAGER", "TECHNICIAN", "SUPERVISOR");
    private static final EnumSet<RoleCode> ALLOWED_ROLE_CODES =
            EnumSet.of(RoleCode.ADMIN, RoleCode.LIMITED_ADMIN, RoleCode.TECHNICIAN, RoleCode.LIMITED_TECHNICIAN);

    private final WorkOrderRepository workOrderRepository;
    private final AssetRepository assetRepository;
    private final WorkOrderService workOrderService;
    private final LaborService laborService;
    private final TaskService taskService;
    private final WorkOrderHistoryService workOrderHistoryService;
    private final NotificationService notificationService;
    private final FileService fileService;
    private final UserService userService;
    private final LocationService locationService;
    private final AssetService assetService;
    private final TeamService teamService;
    private final WorkOrderCategoryService workOrderCategoryService;

    public AgentToolResponse<AgentWorkOrderSummary> searchWorkOrders(OwnUser user,
                                                                     AgentWorkOrderSearchRequest request) {
        ensureAuthorised(user);
        int limit = resolveLimit(request.getLimit());
        SearchCriteria criteria = baseCriteria(limit, "updatedAt");
        criteria.getFilterFields().add(FilterField.builder()
                .field("company.id")
                .operation("eq")
                .value(user.getCompany().getId())
                .build());
        criteria.getFilterFields().add(FilterField.builder()
                .field("archived")
                .operation("eq")
                .value(false)
                .build());
        appendWorkOrderStatusFilter(criteria, request.getStatuses());
        appendSearchFilter(criteria, request.getSearch(), buildWorkOrderSearchFields());

        Page<WorkOrder> page = workOrderRepository.findAll(buildSpecification(criteria), toPageable(criteria));
        List<AgentWorkOrderSummary> items = page.getContent().stream()
                .map(this::toWorkOrderSummary)
                .collect(Collectors.toList());
        return AgentToolResponse.of(items);
    }

    public AgentToolResponse<AgentAssetSummary> searchAssets(OwnUser user,
                                                             AgentAssetSearchRequest request) {
        ensureAuthorised(user);
        int limit = resolveLimit(request.getLimit());
        SearchCriteria criteria = baseCriteria(limit, "updatedAt");
        criteria.getFilterFields().add(FilterField.builder()
                .field("company.id")
                .operation("eq")
                .value(user.getCompany().getId())
                .build());
        criteria.getFilterFields().add(FilterField.builder()
                .field("archived")
                .operation("eq")
                .value(false)
                .build());
        appendAssetStatusFilter(criteria, request.getStatuses());
        appendSearchFilter(criteria, request.getSearch(), buildAssetSearchFields());

        Page<Asset> page = assetRepository.findAll(buildSpecification(criteria), toPageable(criteria));
        List<AgentAssetSummary> items = page.getContent().stream()
                .map(this::toAssetSummary)
                .collect(Collectors.toList());
        return AgentToolResponse.of(items);
    }

    @Transactional
    public AgentWorkOrderCreateResponse createWorkOrder(OwnUser user,
                                                        AgentWorkOrderCreateRequest request) {
        ensureAuthorised(user);

        if (request == null) {
            throw new CustomException("Work order creation request missing", HttpStatus.BAD_REQUEST);
        }

        if (!StringUtils.hasText(request.getTitle())) {
            throw new CustomException("Work order title is required", HttpStatus.BAD_REQUEST);
        }

        WorkOrderPostDTO workOrder = new WorkOrderPostDTO();
        workOrder.setTitle(request.getTitle().trim());

        if (StringUtils.hasText(request.getDescription())) {
            workOrder.setDescription(request.getDescription().trim());
        }

        if (StringUtils.hasText(request.getPriority())) {
            workOrder.setPriority(Priority.getPriorityFromString(request.getPriority()));
        } else {
            workOrder.setPriority(Priority.LOW);
        }

        if (StringUtils.hasText(request.getDueDate())) {
            Date dueDate = parseDateValue(request.getDueDate());
            if (dueDate != null) {
                workOrder.setDueDate(dueDate);
            }
        }

        if (StringUtils.hasText(request.getEstimatedStartDate())) {
            Date estimatedStartDate = parseDateValue(request.getEstimatedStartDate());
            if (estimatedStartDate != null) {
                workOrder.setEstimatedStartDate(estimatedStartDate);
            }
        }

        if (request.getEstimatedDurationHours() != null) {
            workOrder.setEstimatedDuration(request.getEstimatedDurationHours());
        }

        if (request.getRequireSignature() != null) {
            workOrder.setRequiredSignature(request.getRequireSignature());
        }

        if (request.getLocationId() != null) {
            Location location = new Location();
            location.setId(request.getLocationId());
            workOrder.setLocation(location);
        }

        if (request.getAssetId() != null) {
            Asset asset = new Asset();
            asset.setId(request.getAssetId());
            workOrder.setAsset(asset);
        }

        if (request.getTeamId() != null) {
            Team team = new Team();
            team.setId(request.getTeamId());
            workOrder.setTeam(team);
        }

        if (request.getPrimaryUserId() != null) {
            OwnUser primaryUser = new OwnUser();
            primaryUser.setId(request.getPrimaryUserId());
            workOrder.setPrimaryUser(primaryUser);
        }

        if (request.getAssignedUserIds() != null && !request.getAssignedUserIds().isEmpty()) {
            List<OwnUser> assigned = request.getAssignedUserIds().stream()
                    .filter(Objects::nonNull)
                    .map(userId -> {
                        OwnUser assignedUser = new OwnUser();
                        assignedUser.setId(userId);
                        return assignedUser;
                    })
                    .collect(Collectors.toCollection(ArrayList::new));
            workOrder.setAssignedTo(assigned);
        }

        if (request.getCategoryId() != null) {
            WorkOrderCategory category = new WorkOrderCategory();
            category.setId(request.getCategoryId());
            workOrder.setCategory(category);
        }

        workOrder.setCompany(user.getCompany());
        workOrder.setCreatedBy(user.getId());
        workOrder.setStatus(Status.OPEN);

        WorkOrder created = workOrderService.create(workOrder, user.getCompany());

        return AgentWorkOrderCreateResponse.builder()
                .success(true)
                .workOrder(AgentWorkOrderCreateResponse.WorkOrderSummary.builder()
                        .id(created.getId())
                        .code(StringUtils.hasText(created.getCustomId()) ? created.getCustomId() : null)
                        .title(created.getTitle())
                        .status(created.getStatus() != null ? created.getStatus().name() : Status.OPEN.name())
                        .priority(created.getPriority() != null ? created.getPriority().name() : Priority.LOW.name())
                        .createdAt(created.getCreatedAt())
                        .build())
                .message("Work order created successfully")
                .build();
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

    @Transactional
    public AgentWorkOrderStatusUpdateResponse updateWorkOrderStatus(OwnUser user,
                                                                    AgentWorkOrderStatusUpdateRequest request) {
        ensureAuthorised(user);
        if (request == null) {
            throw new CustomException("Status update request missing", HttpStatus.BAD_REQUEST);
        }
        Status targetStatus = parseStatus(request.getNewStatus());
        WorkOrder workOrder = resolveWorkOrder(user, request.getWorkOrderId());
        ensureUserCanModify(workOrder, user);

        Status previousStatus = workOrder.getStatus();
        validateStatusTransition(workOrder, targetStatus, user, request);

        List<String> actions = new ArrayList<>();
        applyStatusChange(workOrder, user, targetStatus, request, actions);

        WorkOrder savedWorkOrder = workOrderService.saveAndFlush(workOrder);

        createStatusHistory(savedWorkOrder, user, previousStatus, targetStatus, request);
        dispatchStatusNotifications(savedWorkOrder, user, targetStatus, actions);

        return AgentWorkOrderStatusUpdateResponse.builder()
                .success(true)
                .workOrder(AgentWorkOrderStatusUpdateResponse.StatusChangeSummary.builder()
                        .id(savedWorkOrder.getId())
                        .code(StringUtils.hasText(savedWorkOrder.getCustomId()) ? savedWorkOrder.getCustomId() : null)
                        .previousStatus(previousStatus != null ? previousStatus.name() : null)
                        .newStatus(targetStatus.name())
                        .updatedBy(user.getFullName())
                        .updatedAt(savedWorkOrder.getUpdatedAt())
                        .notes(savedWorkOrder.getStatusChangeNotes())
                        .reasonCode(savedWorkOrder.getOnHoldReasonCode())
                        .build())
                .actions(actions)
                .build();
    }

    private WorkOrder resolveWorkOrder(OwnUser user, String workOrderId) {
        if (!StringUtils.hasText(workOrderId)) {
            throw new CustomException("Work order identifier required", HttpStatus.BAD_REQUEST);
        }
        String trimmed = workOrderId.trim();
        Long companyId = user.getCompany().getId();
        Optional<WorkOrder> optional;
        if (Helper.isNumeric(trimmed)) {
            try {
                Long numericId = Long.parseLong(trimmed);
                optional = workOrderService.findByIdAndCompany(numericId, companyId);
            } catch (NumberFormatException ex) {
                optional = workOrderRepository.findByCustomIdIgnoreCaseAndCompany_Id(trimmed, companyId);
            }
        } else {
            optional = workOrderRepository.findByCustomIdIgnoreCaseAndCompany_Id(trimmed, companyId);
        }
        return optional.orElseThrow(() -> new CustomException("Work order not found", HttpStatus.NOT_FOUND));
    }

    private Status parseStatus(String candidate) {
        if (!StringUtils.hasText(candidate)) {
            throw new CustomException("Target status is required", HttpStatus.BAD_REQUEST);
        }
        String normalized = candidate.trim();
        String canonical = normalized.toUpperCase(Locale.ENGLISH).replace(' ', '_');
        try {
            return Status.valueOf(canonical);
        } catch (IllegalArgumentException ex) {
            Status fallback = Status.getStatusFromString(normalized);
            boolean matches = fallback.matches(normalized) || fallback.name().equalsIgnoreCase(normalized);
            if (!matches) {
                throw new CustomException("Unsupported status: " + candidate, HttpStatus.BAD_REQUEST);
            }
            return fallback;
        }
    }

    private void ensureUserCanModify(WorkOrder workOrder, OwnUser user) {
        if (workOrder.isArchived()) {
            throw new CustomException("Archived work orders cannot be updated", HttpStatus.BAD_REQUEST);
        }
        if (!workOrder.canBeEditedBy(user) && !hasRole(user, RoleCode.ADMIN, RoleCode.LIMITED_ADMIN)) {
            throw new CustomException("You are not allowed to update this work order", HttpStatus.FORBIDDEN);
        }
    }

    private void validateStatusTransition(WorkOrder workOrder,
                                          Status targetStatus,
                                          OwnUser user,
                                          AgentWorkOrderStatusUpdateRequest request) {
        Status currentStatus = workOrder.getStatus();
        if (targetStatus == currentStatus) {
            throw new CustomException("Work order already in status " + targetStatus.name(), HttpStatus.CONFLICT);
        }

        EnumSet<Status> allowedTargets = EnumSet.noneOf(Status.class);
        switch (currentStatus) {
            case OPEN:
                allowedTargets.add(Status.IN_PROGRESS);
                allowedTargets.add(Status.ON_HOLD);
                break;
            case IN_PROGRESS:
                allowedTargets.add(Status.COMPLETE);
                allowedTargets.add(Status.ON_HOLD);
                allowedTargets.add(Status.OPEN);
                break;
            case ON_HOLD:
                allowedTargets.add(Status.OPEN);
                allowedTargets.add(Status.IN_PROGRESS);
                allowedTargets.add(Status.COMPLETE);
                break;
            case COMPLETE:
                allowedTargets.add(Status.OPEN);
                allowedTargets.add(Status.ON_HOLD);
                break;
            default:
                allowedTargets = EnumSet.allOf(Status.class);
        }

        if (!allowedTargets.contains(targetStatus)) {
            throw new CustomException(String.format("Invalid status transition from %s to %s",
                    currentStatus.name(), targetStatus.name()), HttpStatus.BAD_REQUEST);
        }

        if (currentStatus == Status.OPEN && targetStatus == Status.COMPLETE) {
            throw new CustomException("Cannot complete work order without starting it", HttpStatus.BAD_REQUEST);
        }

        if (currentStatus == Status.COMPLETE && targetStatus == Status.OPEN
                && !hasRole(user, RoleCode.ADMIN, RoleCode.LIMITED_ADMIN)) {
            throw new CustomException("Only managers can reopen completed work orders", HttpStatus.FORBIDDEN);
        }

        if (targetStatus == Status.ON_HOLD && !StringUtils.hasText(request.getReasonCode())) {
            throw new CustomException("Reason code required when placing work order on hold", HttpStatus.BAD_REQUEST);
        }

        if (currentStatus == Status.ON_HOLD && targetStatus == Status.COMPLETE) {
            Status previous = workOrder.getStatusBeforeHold();
            if (previous != Status.IN_PROGRESS) {
                throw new CustomException("Resume work before completing the work order", HttpStatus.BAD_REQUEST);
            }
        }
    }

    private void applyStatusChange(WorkOrder workOrder,
                                   OwnUser user,
                                   Status targetStatus,
                                   AgentWorkOrderStatusUpdateRequest request,
                                   List<String> actions) {
        Status currentStatus = workOrder.getStatus();
        Date now = new Date();

        if (workOrder.getFirstTimeToReact() == null && targetStatus != Status.ON_HOLD) {
            workOrder.setFirstTimeToReact(now);
        }

        String notes = StringUtils.hasText(request.getNotes()) ? request.getNotes().trim() : null;
        workOrder.setStatusChangeNotes(notes);

        if (targetStatus == Status.ON_HOLD) {
            workOrder.setStatusBeforeHold(currentStatus);
            workOrder.setOnHoldReasonCode(StringUtils.hasText(request.getReasonCode())
                    ? request.getReasonCode().trim()
                    : null);
        } else if (currentStatus == Status.ON_HOLD) {
            workOrder.setOnHoldReasonCode(null);
            workOrder.setStatusBeforeHold(null);
        }

        applyCompletionData(workOrder, user, request.getCompletionData());

        if (targetStatus == Status.COMPLETE) {
            enforceCompletionRequirements(workOrder);
            workOrder.setCompletedBy(user);
            workOrder.setCompletedOn(now);
            actions.add("Completion timestamp recorded");
        } else if (currentStatus == Status.COMPLETE && targetStatus != Status.COMPLETE) {
            workOrder.setCompletedBy(null);
            workOrder.setCompletedOn(null);
        }

        handleLaborTimers(workOrder, user, currentStatus, targetStatus, actions, now);
        workOrder.setStatus(targetStatus);
    }

    private void applyCompletionData(WorkOrder workOrder,
                                     OwnUser user,
                                     AgentWorkOrderStatusUpdateRequest.CompletionData completionData) {
        if (completionData == null) {
            return;
        }
        if (completionData.getSignatureFileId() != null) {
            File signature = fileService.findById(completionData.getSignatureFileId())
                    .orElseThrow(() -> new CustomException("Signature file not found", HttpStatus.NOT_FOUND));
            if (!Objects.equals(signature.getCompany().getId(), user.getCompany().getId())) {
                throw new CustomException("Signature file belongs to another company", HttpStatus.FORBIDDEN);
            }
            workOrder.setSignature(signature);
        }
        if (completionData.getFeedback() != null) {
            String feedback = completionData.getFeedback().trim();
            workOrder.setFeedback(feedback.isEmpty() ? null : feedback);
        }
    }

    private void enforceCompletionRequirements(WorkOrder workOrder) {
        if (workOrder.isRequiredSignature() && workOrder.getSignature() == null) {
            throw new CustomException("Signature required to complete this work order", HttpStatus.BAD_REQUEST);
        }
        List<Task> tasks = taskService.findByWorkOrder(workOrder.getId());
        if (!CollectionUtils.isEmpty(tasks)) {
            boolean hasIncomplete = tasks.stream().anyMatch(this::isTaskIncomplete);
            if (hasIncomplete) {
                throw new CustomException("Complete all tasks before closing the work order",
                        HttpStatus.BAD_REQUEST);
            }
        }
    }

    private boolean isTaskIncomplete(Task task) {
        if (task == null) {
            return false;
        }
        String value = task.getValue();
        if (!StringUtils.hasText(value)) {
            return true;
        }
        String normalized = value.trim().toUpperCase(Locale.ENGLISH);
        return normalized.equals("OPEN") || normalized.equals("IN_PROGRESS") || normalized.equals("ON_HOLD");
    }

    private void handleLaborTimers(WorkOrder workOrder,
                                   OwnUser user,
                                   Status previousStatus,
                                   Status targetStatus,
                                   List<String> actions,
                                   Date now) {
        Collection<Labor> labors = laborService.findByWorkOrder(workOrder.getId());
        if (labors == null) {
            labors = Collections.emptyList();
        }

        if (targetStatus == Status.IN_PROGRESS) {
            boolean alreadyRunning = labors.stream().anyMatch(labor ->
                    labor.getStatus() == TimeStatus.RUNNING
                            && labor.getAssignedTo() != null
                            && Objects.equals(labor.getAssignedTo().getId(), user.getId()));
            if (!alreadyRunning) {
                Labor labor = new Labor();
                labor.setAssignedTo(user);
                labor.setWorkOrder(workOrder);
                labor.setStartedAt(now);
                labor.setStatus(TimeStatus.RUNNING);
                laborService.create(labor);
                actions.add("Labor timer started for " + user.getFullName());
            }
            if (workOrder.getPrimaryUser() == null) {
                workOrder.setPrimaryUser(user);
            }
        }

        if (previousStatus == Status.IN_PROGRESS && targetStatus != Status.IN_PROGRESS) {
            List<String> stopped = new ArrayList<>();
            for (Labor labor : labors) {
                if (labor.getStatus() == TimeStatus.RUNNING) {
                    laborService.stop(labor);
                    stopped.add(labor.getAssignedTo() != null ? labor.getAssignedTo().getFullName() : "technician");
                }
            }
            if (!stopped.isEmpty()) {
                actions.add("Labor timers stopped for " + String.join(", ", stopped));
            }
        }
    }

    private void createStatusHistory(WorkOrder workOrder,
                                     OwnUser user,
                                     Status previousStatus,
                                     Status targetStatus,
                                     AgentWorkOrderStatusUpdateRequest request) {
        StringBuilder summary = new StringBuilder("Status changed from ")
                .append(previousStatus != null ? previousStatus.name() : "UNKNOWN")
                .append(" to ")
                .append(targetStatus.name());
        if (StringUtils.hasText(request.getNotes())) {
            summary.append(" • ").append(request.getNotes().trim());
        }
        if (targetStatus == Status.ON_HOLD && StringUtils.hasText(request.getReasonCode())) {
            summary.append(" • reason: ").append(request.getReasonCode().trim());
        }
        WorkOrderHistory history = WorkOrderHistory.builder()
                .workOrder(workOrder)
                .user(user)
                .name(summary.toString())
                .build();
        workOrderHistoryService.create(history);
    }

    private void dispatchStatusNotifications(WorkOrder workOrder,
                                             OwnUser actor,
                                             Status targetStatus,
                                             List<String> actions) {
        Collection<OwnUser> recipients = workOrder.getUsers();
        if (CollectionUtils.isEmpty(recipients)) {
            return;
        }
        String statusLabel = targetStatus.name().replace('_', ' ');
        String message = String.format("%s set \"%s\" to %s", actor.getFullName(), workOrder.getTitle(), statusLabel);
        List<Notification> notifications = recipients.stream()
                .filter(OwnUser::isEnabled)
                .filter(recipient -> !Objects.equals(recipient.getId(), actor.getId()))
                .map(recipient -> new Notification(message, recipient, NotificationType.WORK_ORDER, workOrder.getId()))
                .collect(Collectors.toList());
        if (notifications.isEmpty()) {
            return;
        }
        notificationService.createMultiple(notifications, true, "Work order status updated");
        actions.add("Notification sent to assigned users");
    }

    private boolean hasRole(OwnUser user, RoleCode... roleCodes) {
        if (user == null || user.getRole() == null) {
            return false;
        }
        RoleCode code = user.getRole().getCode();
        if (code != null) {
            for (RoleCode roleCode : roleCodes) {
                if (roleCode == code) {
                    return true;
                }
            }
        }
        String roleName = user.getRole().getName();
        if (StringUtils.hasText(roleName)) {
            for (RoleCode roleCode : roleCodes) {
                if (roleCode.name().equalsIgnoreCase(roleName.trim())) {
                    return true;
                }
            }
        }
        return false;
    }

    private void ensureAuthorised(OwnUser user) {
        if (user == null) {
            throw new CustomException("Authenticated user context required", HttpStatus.UNAUTHORIZED);
        }
        if (user.getRole() == null) {
            throw new CustomException("User role missing; contact an administrator", HttpStatus.FORBIDDEN);
        }
        if (user.getCompany() == null || user.getCompany().getId() == null) {
            throw new CustomException("Tenant context missing for user", HttpStatus.FORBIDDEN);
        }
        RoleCode roleCode = user.getRole().getCode();
        boolean authorised = roleCode != null && ALLOWED_ROLE_CODES.contains(roleCode);
        if (!authorised && StringUtils.hasText(user.getRole().getName())) {
            String roleName = user.getRole().getName().trim().toUpperCase(Locale.ENGLISH);
            authorised = ALLOWED_ROLE_NAMES.contains(roleName);
        }
        if (!authorised) {
            throw new CustomException("User is not authorised to use agent tools", HttpStatus.FORBIDDEN);
        }
    }

    private AgentWorkOrderSummary toWorkOrderSummary(WorkOrder workOrder) {
        return AgentWorkOrderSummary.builder()
                .id(workOrder.getId())
                .code(StringUtils.hasText(workOrder.getCustomId()) ? workOrder.getCustomId() : null)
                .title(workOrder.getTitle())
                .status(workOrder.getStatus() != null ? workOrder.getStatus().name() : null)
                .priority(workOrder.getPriority() != null ? workOrder.getPriority().name() : null)
                .asset(workOrder.getAsset() != null ? workOrder.getAsset().getName() : null)
                .location(workOrder.getLocation() != null ? workOrder.getLocation().getName() : null)
                .dueDate(workOrder.getDueDate())
                .updatedAt(workOrder.getUpdatedAt())
                .build();
    }

    private AgentAssetSummary toAssetSummary(Asset asset) {
        return AgentAssetSummary.builder()
                .id(asset.getId())
                .name(asset.getName())
                .status(asset.getStatus() != null ? asset.getStatus().name() : null)
                .location(asset.getLocation() != null ? asset.getLocation().getName() : null)
                .customId(StringUtils.hasText(asset.getCustomId()) ? asset.getCustomId() : null)
                .category(asset.getCategory() != null ? asset.getCategory().getName() : null)
                .build();
    }

    private int resolveLimit(Integer candidate) {
        if (candidate == null) {
            return DEFAULT_LIMIT;
        }
        return Math.max(1, Math.min(candidate, MAX_LIMIT));
    }

    private SearchCriteria baseCriteria(int limit, String sortField) {
        SearchCriteria criteria = SearchCriteria.builder()
                .pageNum(0)
                .pageSize(limit)
                .sortField(sortField)
                .direction(Sort.Direction.DESC)
                .build();
        if (criteria.getFilterFields() == null) {
            criteria.setFilterFields(new ArrayList<>());
        }
        return criteria;
    }

    private Pageable toPageable(SearchCriteria criteria) {
        Sort sort = Sort.by(criteria.getDirection(), criteria.getSortField());
        return PageRequest.of(criteria.getPageNum(), criteria.getPageSize(), sort);
    }

    private void appendWorkOrderStatusFilter(SearchCriteria criteria, List<String> statuses) {
        if (CollectionUtils.isEmpty(statuses)) {
            return;
        }
        List<Object> values = statuses.stream()
                .filter(StringUtils::hasText)
                .map(Status::getStatusFromString)
                .filter(Objects::nonNull)
                .map(Status::name)
                .distinct()
                .collect(Collectors.toList());
        if (values.isEmpty()) {
            return;
        }
        criteria.getFilterFields().add(FilterField.builder()
                .field("status")
                .operation("in")
                .values(values)
                .enumName(EnumName.STATUS)
                .build());
    }

    private void appendAssetStatusFilter(SearchCriteria criteria, List<String> statuses) {
        if (CollectionUtils.isEmpty(statuses)) {
            return;
        }
        List<Object> values = statuses.stream()
                .map(this::parseAssetStatus)
                .filter(Objects::nonNull)
                .map(Enum::name)
                .distinct()
                .collect(Collectors.toList());
        if (values.isEmpty()) {
            return;
        }
        criteria.getFilterFields().add(FilterField.builder()
                .field("status")
                .operation("in")
                .values(values)
                .build());
    }

    private AssetStatus parseAssetStatus(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        try {
            return AssetStatus.valueOf(value.trim().toUpperCase(Locale.ENGLISH).replace(' ', '_'));
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private void appendSearchFilter(SearchCriteria criteria, String search, List<String> fields) {
        if (!StringUtils.hasText(search)) {
            return;
        }
        String term = search.trim();
        if (CollectionUtils.isEmpty(fields)) {
            return;
        }
        FilterField primary = FilterField.builder()
                .field(fields.get(0))
                .operation("cn")
                .value(term)
                .alternatives(fields.stream()
                        .skip(1)
                        .map(field -> FilterField.builder()
                                .field(field)
                                .operation("cn")
                                .value(term)
                                .build())
                        .collect(Collectors.toList()))
                .build();
        criteria.getFilterFields().add(primary);
    }

    private List<String> buildWorkOrderSearchFields() {
        List<String> fields = new ArrayList<>();
        fields.add("title");
        fields.add("description");
        fields.add("customId");
        return fields;
    }

    private List<String> buildAssetSearchFields() {
        List<String> fields = new ArrayList<>();
        fields.add("name");
        fields.add("customId");
        return fields;
    }

    private <T> org.springframework.data.jpa.domain.Specification<T> buildSpecification(SearchCriteria criteria) {
        SpecificationBuilder<T> builder = new SpecificationBuilder<>();
        criteria.getFilterFields().forEach(builder::with);
        return builder.build();
    }

    @Transactional
    public AgentWorkOrderUpdateResponse updateWorkOrder(OwnUser user, String workOrderId, AgentWorkOrderUpdateRequest request) {
        ensureAuthorised(user);

        if (request == null) {
            throw new CustomException("Work order update request missing", HttpStatus.BAD_REQUEST);
        }

        WorkOrder workOrder = resolveWorkOrder(user, workOrderId);
        ensureUserCanModify(workOrder, user);

        List<String> updatedFields = new ArrayList<>();

        // Update title
        if (request.hasTitleValue()) {
            String newTitle = request.getTitle().get();
            if (StringUtils.hasText(newTitle)) {
                workOrder.setTitle(newTitle.trim());
                updatedFields.add("title");
            } else {
                throw new CustomException("Title cannot be empty", HttpStatus.BAD_REQUEST);
            }
        }

        // Update description
        if (request.hasDescriptionValue()) {
            String newDescription = request.getDescription().get();
            workOrder.setDescription(newDescription != null ? newDescription.trim() : null);
            updatedFields.add("description");
        }

        // Update priority
        if (request.hasPriorityValue()) {
            String priorityStr = request.getPriority().get();
            if (StringUtils.hasText(priorityStr)) {
                workOrder.setPriority(Priority.getPriorityFromString(priorityStr.trim()));
                updatedFields.add("priority");
            }
        }

        // Update due date
        if (request.hasDueDateValue()) {
            workOrder.setDueDate(request.getDueDate().get());
            updatedFields.add("dueDate");
        }

        // Update estimated start date
        if (request.hasEstimatedStartDateValue()) {
            workOrder.setEstimatedStartDate(request.getEstimatedStartDate().get());
            updatedFields.add("estimatedStartDate");
        }

        // Update estimated duration
        if (request.hasEstimatedDurationValue()) {
            Double duration = request.getEstimatedDurationHours().get();
            workOrder.setEstimatedDuration(duration != null ? duration : 0.0);
            updatedFields.add("estimatedDuration");
        }

        // Update require signature
        if (request.hasRequireSignatureValue()) {
            Boolean requireSignature = request.getRequireSignature().get();
            workOrder.setRequiredSignature(requireSignature != null && requireSignature);
            updatedFields.add("requireSignature");
        }

        // Update location
        if (request.hasLocationIdValue()) {
            Long locationId = request.getLocationId().get();
            if (locationId != null) {
                Location location = locationService.findById(locationId)
                        .orElseThrow(() -> new CustomException("Location not found", HttpStatus.NOT_FOUND));
                if (!Objects.equals(location.getCompany().getId(), user.getCompany().getId())) {
                    throw new CustomException("Location belongs to another company", HttpStatus.FORBIDDEN);
                }
                workOrder.setLocation(location);
            } else {
                workOrder.setLocation(null);
            }
            updatedFields.add("location");
        }

        // Update asset
        if (request.hasAssetIdValue()) {
            Long assetId = request.getAssetId().get();
            if (assetId != null) {
                Asset asset = assetService.findById(assetId)
                        .orElseThrow(() -> new CustomException("Asset not found", HttpStatus.NOT_FOUND));
                if (!Objects.equals(asset.getCompany().getId(), user.getCompany().getId())) {
                    throw new CustomException("Asset belongs to another company", HttpStatus.FORBIDDEN);
                }
                workOrder.setAsset(asset);
            } else {
                workOrder.setAsset(null);
            }
            updatedFields.add("asset");
        }

        // Update team
        if (request.hasTeamIdValue()) {
            Long teamId = request.getTeamId().get();
            if (teamId != null) {
                Team team = teamService.findById(teamId)
                        .orElseThrow(() -> new CustomException("Team not found", HttpStatus.NOT_FOUND));
                if (!Objects.equals(team.getCompany().getId(), user.getCompany().getId())) {
                    throw new CustomException("Team belongs to another company", HttpStatus.FORBIDDEN);
                }
                workOrder.setTeam(team);
            } else {
                workOrder.setTeam(null);
            }
            updatedFields.add("team");
        }

        // Update primary user
        if (request.hasPrimaryUserIdValue()) {
            Long primaryUserId = request.getPrimaryUserId().get();
            if (primaryUserId != null) {
                OwnUser primaryUser = userService.findById(primaryUserId)
                        .orElseThrow(() -> new CustomException("User not found", HttpStatus.NOT_FOUND));
                if (!Objects.equals(primaryUser.getCompany().getId(), user.getCompany().getId())) {
                    throw new CustomException("User belongs to another company", HttpStatus.FORBIDDEN);
                }
                workOrder.setPrimaryUser(primaryUser);
            } else {
                workOrder.setPrimaryUser(null);
            }
            updatedFields.add("primaryUser");
        }

        // Update assigned users
        if (request.hasAssignedUserIdsValue()) {
            List<Long> assignedUserIds = request.getAssignedUserIds().get();
            if (assignedUserIds != null && !assignedUserIds.isEmpty()) {
                List<OwnUser> assignedUsers = new ArrayList<>();
                for (Long userId : assignedUserIds) {
                    OwnUser assignedUser = userService.findById(userId)
                            .orElseThrow(() -> new CustomException("User with ID " + userId + " not found", HttpStatus.NOT_FOUND));
                    if (!Objects.equals(assignedUser.getCompany().getId(), user.getCompany().getId())) {
                        throw new CustomException("User with ID " + userId + " belongs to another company", HttpStatus.FORBIDDEN);
                    }
                    assignedUsers.add(assignedUser);
                }
                workOrder.setAssignedTo(assignedUsers);
            } else {
                workOrder.setAssignedTo(new ArrayList<>());
            }
            updatedFields.add("assignedUsers");
        }

        // Update category
        if (request.hasCategoryIdValue()) {
            Long categoryId = request.getCategoryId().get();
            if (categoryId != null) {
                WorkOrderCategory category = workOrderCategoryService.findById(categoryId)
                        .orElseThrow(() -> new CustomException("Category not found", HttpStatus.NOT_FOUND));
                if (!Objects.equals(category.getCompanySettings().getCompany().getId(), user.getCompany().getId())) {
                    throw new CustomException("Category belongs to another company", HttpStatus.FORBIDDEN);
                }
                workOrder.setCategory(category);
            } else {
                workOrder.setCategory(null);
            }
            updatedFields.add("category");
        }

        WorkOrder savedWorkOrder = workOrderService.saveAndFlush(workOrder);

        // Create history entry
        if (!updatedFields.isEmpty()) {
            String updateSummary = "Agent updated: " + String.join(", ", updatedFields);
            WorkOrderHistory history = WorkOrderHistory.builder()
                    .workOrder(savedWorkOrder)
                    .user(user)
                    .name(updateSummary)
                    .build();
            workOrderHistoryService.create(history);
        }

        return AgentWorkOrderUpdateResponse.builder()
                .success(true)
                .workOrder(buildWorkOrderUpdateSummary(savedWorkOrder))
                .message("Work order updated successfully")
                .updatedFields(updatedFields)
                .build();
    }

    private AgentWorkOrderUpdateResponse.WorkOrderUpdateSummary buildWorkOrderUpdateSummary(WorkOrder workOrder) {
        List<String> assignedUserNames = workOrder.getAssignedTo() != null
                ? workOrder.getAssignedTo().stream()
                .map(OwnUser::getFullName)
                .collect(Collectors.toList())
                : Collections.emptyList();

        return AgentWorkOrderUpdateResponse.WorkOrderUpdateSummary.builder()
                .id(workOrder.getId())
                .code(StringUtils.hasText(workOrder.getCustomId()) ? workOrder.getCustomId() : null)
                .title(workOrder.getTitle())
                .description(workOrder.getDescription())
                .status(workOrder.getStatus() != null ? workOrder.getStatus().name() : null)
                .priority(workOrder.getPriority() != null ? workOrder.getPriority().name() : null)
                .dueDate(workOrder.getDueDate())
                .primaryUserName(workOrder.getPrimaryUser() != null ? workOrder.getPrimaryUser().getFullName() : null)
                .assignedUserNames(assignedUserNames)
                .updatedAt(workOrder.getUpdatedAt())
                .build();
    }
}




