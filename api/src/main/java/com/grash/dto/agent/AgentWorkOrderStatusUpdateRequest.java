package com.grash.dto.agent;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Data;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;

@Data
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentWorkOrderStatusUpdateRequest {
    @NotBlank
    private String workOrderId;

    @NotBlank
    private String newStatus;

    private String notes;

    private String reasonCode;

    @Valid
    private CompletionData completionData;

    @Data
    @JsonInclude(JsonInclude.Include.NON_NULL)
    public static class CompletionData {
        private Long signatureFileId;
        private String feedback;
    }
}
