package com.grash.dto.agent;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.Collections;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AgentToolResponse<T> {
    private List<T> results = Collections.emptyList();
    private int total;

    public static <T> AgentToolResponse<T> of(List<T> results) {
        int size = results == null ? 0 : results.size();
        return new AgentToolResponse<>(results, size);
    }
}
