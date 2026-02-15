package com.grash.dto.agent;

import javax.validation.constraints.NotEmpty;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class AgentPartSubstituteRequest {
    @NotEmpty
    private String partIdentifier;
}
