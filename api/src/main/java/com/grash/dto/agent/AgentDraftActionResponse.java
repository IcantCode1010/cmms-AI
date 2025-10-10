package com.grash.dto.agent;

import lombok.Builder;
import lombok.Value;

import java.time.Instant;

@Value
@Builder
public class AgentDraftActionResponse {
    Long id;
    String agentSessionId;
    String operationType;
    String payload;
    String status;
    Instant createdAt;
    Instant updatedAt;
}
