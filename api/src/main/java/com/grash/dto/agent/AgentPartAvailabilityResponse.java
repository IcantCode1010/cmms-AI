package com.grash.dto.agent;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AgentPartAvailabilityResponse {
    private boolean available;
    private double currentQuantity;
    private double minQuantity;
    private String partName;
    private String partId;
    private String location;
}
