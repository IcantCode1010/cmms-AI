package com.grash.dto.agent;

import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import java.util.ArrayList;
import java.util.List;

@Data
public class AgentWorkOrderSearchRequest {
    // Existing fields
    private List<String> statuses = new ArrayList<>();
    private String search;
    @Min(1)
    @Max(50)
    private Integer limit;

    // Date range filters (ISO 8601 format strings)
    private String dueDateBefore;
    private String dueDateAfter;
    private String createdAtBefore;
    private String createdAtAfter;
    private String updatedAtBefore;
    private String updatedAtAfter;

    // Assignment filters
    private Long assignedToUserId;
    private Long primaryUserId;
    private Long teamId;

    // Classification filters
    private Long assetId;
    private Long locationId;
    private Long categoryId;
    private List<String> priorities;

    // Sorting
    private String sortBy;  // dueDate, priority, status, createdAt, updatedAt
    private String sortDirection;  // ASC, DESC (default DESC)
}
