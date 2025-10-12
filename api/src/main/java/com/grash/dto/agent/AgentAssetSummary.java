package com.grash.dto.agent;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Value;

@Value
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentAssetSummary {
    Long id;
    String name;
    String status;
    String location;
    String customId;
    String category;
}
