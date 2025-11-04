
package com.grash.dto.agent;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.util.List;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentWorkOrderCreateRequest {
    @NotBlank
    private String title;

    private String description;

    private String priority;

    private String dueDate;

    private String estimatedStartDate;

    private Double estimatedDurationHours;

    private Boolean requireSignature;

    private Long locationId;

    private Long assetId;

    private Long teamId;

    private Long primaryUserId;

    private List<Long> assignedUserIds;

    private Long categoryId;

    private String summary;
}
