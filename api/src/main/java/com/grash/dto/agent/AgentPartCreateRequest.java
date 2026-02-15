package com.grash.dto.agent;

import java.util.List;
import javax.validation.constraints.NotEmpty;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
public class AgentPartCreateRequest {
    @NotEmpty
    private List<PartRequest> parts;

    @Data
    @NoArgsConstructor
    public static class PartRequest {
        @NotEmpty
        private String name;
        private Double cost;
        private String category;
        private Double quantity;
        private Double minQuantity;
        private String barcode;
        private String area;
        private String description;
        private String additionalInfos;
    }
}
