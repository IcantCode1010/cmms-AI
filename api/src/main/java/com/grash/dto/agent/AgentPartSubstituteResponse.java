package com.grash.dto.agent;

import java.util.List;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AgentPartSubstituteResponse {
    private String originalPartId;
    private List<SubstituteSummary> substitutes;

    @Data
    @Builder
    public static class SubstituteSummary {
        private Long id;
        private String name;
        private double quantity;
        private String location;
        private double cost;
        private double confidenceScore; // calculated based on name similarity or category match
    }
}
