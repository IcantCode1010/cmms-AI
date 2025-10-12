package com.grash.dto.agent;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Builder;
import lombok.Value;

import java.util.Date;

@Value
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentWorkOrderSummary {
    Long id;
    String code;
    String title;
    String status;
    String priority;
    String asset;
    String location;
    Date dueDate;
    Date updatedAt;
}
