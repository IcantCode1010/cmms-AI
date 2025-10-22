package com.grash.dto.agent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentWorkOrderUpdateRequest {

    private Optional<String> title;

    private Optional<String> description;

    private Optional<String> priority;

    private Optional<Date> dueDate;

    private Optional<Date> estimatedStartDate;

    private Optional<Double> estimatedDurationHours;

    private Optional<Boolean> requireSignature;

    private Optional<Long> locationId;

    private Optional<Long> assetId;

    private Optional<Long> teamId;

    private Optional<Long> primaryUserId;

    private Optional<List<Long>> assignedUserIds;

    private Optional<Long> categoryId;

    // Helper methods to check if field is present with non-null value
    public boolean hasTitleValue() {
        return title != null && title.isPresent();
    }

    public boolean hasDescriptionValue() {
        return description != null && description.isPresent();
    }

    public boolean hasPriorityValue() {
        return priority != null && priority.isPresent();
    }

    public boolean hasDueDateValue() {
        return dueDate != null && dueDate.isPresent();
    }

    public boolean hasEstimatedStartDateValue() {
        return estimatedStartDate != null && estimatedStartDate.isPresent();
    }

    public boolean hasEstimatedDurationValue() {
        return estimatedDurationHours != null && estimatedDurationHours.isPresent();
    }

    public boolean hasRequireSignatureValue() {
        return requireSignature != null && requireSignature.isPresent();
    }

    public boolean hasLocationIdValue() {
        return locationId != null && locationId.isPresent();
    }

    public boolean hasAssetIdValue() {
        return assetId != null && assetId.isPresent();
    }

    public boolean hasTeamIdValue() {
        return teamId != null && teamId.isPresent();
    }

    public boolean hasPrimaryUserIdValue() {
        return primaryUserId != null && primaryUserId.isPresent();
    }

    public boolean hasAssignedUserIdsValue() {
        return assignedUserIds != null && assignedUserIds.isPresent();
    }

    public boolean hasCategoryIdValue() {
        return categoryId != null && categoryId.isPresent();
    }
}
