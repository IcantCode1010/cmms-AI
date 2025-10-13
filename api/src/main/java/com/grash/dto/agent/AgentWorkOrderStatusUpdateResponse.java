package com.grash.dto.agent;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Singular;
import lombok.Value;

import java.util.Date;
import java.util.List;

@Value
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentWorkOrderStatusUpdateResponse {
    boolean success;
    StatusChangeSummary workOrder;
    @Singular
    List<String> actions;

    @Value
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class StatusChangeSummary {
        Long id;
        String code;
        String previousStatus;
        String newStatus;
        String updatedBy;
        Date updatedAt;
        String notes;
        String reasonCode;
    }
}
