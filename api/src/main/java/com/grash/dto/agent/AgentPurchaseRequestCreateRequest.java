package com.grash.dto.agent;

import javax.validation.constraints.NotEmpty;
import javax.validation.constraints.NotNull;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class AgentPurchaseRequestCreateRequest {
    @NotEmpty
    private String name;
    
    private String description;
    
    @NotNull
    private Long vendorId;
    
    private String shippingInstructions;
    
    // Simplification: In a real scenario, we'd have line items. 
    // For now, let's assume the request description or name covers what is needed, 
    // or we could add a list of part IDs and quantities later.
}
