package com.grash.dto.agent;

import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AgentPartCreateResponse {
    private boolean success;
    private int createdCount;
    private List<Long> createdPartIds;
    private String message;
}
