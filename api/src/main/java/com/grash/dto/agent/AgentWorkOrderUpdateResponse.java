package com.grash.dto.agent;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AgentWorkOrderUpdateResponse {

    private boolean success;
    private WorkOrderUpdateSummary workOrder;
    private String message;
    private List<String> updatedFields;

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class WorkOrderUpdateSummary {
        private Long id;
        private String code;
        private String title;
        private String description;
        private String status;
        private String priority;
        private Date dueDate;
        private String primaryUserName;
        private List<String> assignedUserNames;
        private Date updatedAt;
    }
}
