package com.grash.dto.agent;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AgentPurchaseRequestCreateResponse {
    private boolean success;
    private Long purchaseOrderId;
    private String status;
    private String message;
}
