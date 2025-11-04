package com.grash.dto.agent;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Data;

import java.util.Date;

@Data
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentWorkOrderCreateResponse {
    private boolean success;
    private WorkOrderSummary workOrder;
    private String message;

    @Data
    @Builder
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class WorkOrderSummary {
        private Long id;
        private String code;
        private String title;
        private String status;
        private String priority;
        private Date createdAt;
    }
}
