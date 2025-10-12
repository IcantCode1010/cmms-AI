package com.grash.dto.agent;

import lombok.Data;

import javax.validation.constraints.Max;
import javax.validation.constraints.Min;
import java.util.ArrayList;
import java.util.List;

@Data
public class AgentWorkOrderSearchRequest {
    private List<String> statuses = new ArrayList<>();
    private String search;
    @Min(1)
    @Max(50)
    private Integer limit;
}
