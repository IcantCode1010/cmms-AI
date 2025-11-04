package com.grash.dto.agent;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Value;

import java.util.Date;
import java.util.List;

@Value
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentWorkOrderDetails {

    // Core fields
    Long id;
    String code;
    String title;
    String description;
    String status;
    String priority;

    // Date fields
    Date dueDate;
    Date estimatedStartDate;
    Date completedOn;
    Double estimatedDurationHours;

    // Relationships
    AssetSummary asset;
    LocationSummary location;
    UserSummary primaryUser;
    List<UserSummary> assignedUsers;
    TeamSummary team;
    CategorySummary category;

    // Related data
    List<TaskSummary> tasks;
    List<LaborSummary> labor;
    List<HistoryEntry> history;
    List<FileSummary> files;

    // Nested DTOs

    @Value
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class AssetSummary {
        Long id;
        String name;
        String customId;
        String status;
    }

    @Value
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class LocationSummary {
        Long id;
        String name;
    }

    @Value
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class UserSummary {
        Long id;
        String fullName;
        String email;
    }

    @Value
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TeamSummary {
        Long id;
        String name;
    }

    @Value
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CategorySummary {
        Long id;
        String name;
    }

    @Value
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class TaskSummary {
        Long id;
        String label;
        String taskValue;
        String notes;
    }

    @Value
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class LaborSummary {
        Long id;
        String workerName;
        Long durationSeconds;
        Date startedAt;
        String status;
        String timeCategory;
    }

    @Value
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class HistoryEntry {
        Long id;
        String action;
        String userName;
        Date timestamp;
    }

    @Value
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class FileSummary {
        Long id;
        String name;
        String url;
    }
}
