package com.grash.service;

import com.grash.advancedsearch.FilterField;
import com.grash.advancedsearch.SearchCriteria;
import com.grash.advancedsearch.SpecificationBuilder;
import com.grash.dto.agent.AgentAssetSearchRequest;
import com.grash.dto.agent.AgentAssetSummary;
import com.grash.dto.agent.AgentToolResponse;
import com.grash.dto.agent.AgentWorkOrderSearchRequest;
import com.grash.dto.agent.AgentWorkOrderSummary;
import com.grash.exception.CustomException;
import com.grash.model.Asset;
import com.grash.model.OwnUser;
import com.grash.model.WorkOrder;
import com.grash.model.enums.AssetStatus;
import com.grash.model.enums.EnumName;
import com.grash.model.enums.RoleCode;
import com.grash.model.enums.Status;
import com.grash.repository.AssetRepository;
import com.grash.repository.WorkOrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
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
        fields.add("location.name");
        return fields;
    }

    private <T> org.springframework.data.jpa.domain.Specification<T> buildSpecification(SearchCriteria criteria) {
        SpecificationBuilder<T> builder = new SpecificationBuilder<>();
        criteria.getFilterFields().forEach(builder::with);
        return builder.build();
    }
}




