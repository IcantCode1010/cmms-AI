package com.grash.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc(addFilters = false)
class AgentControllerIT {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void chatReturnsNotImplementedWhenFeatureFlagDisabled() throws Exception {
        mockMvc.perform(post("/api/agent/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"prompt\":\"Hello assistant\"}"))
                .andExpect(status().isNotImplemented())
                .andExpect(jsonPath("$.status").value("disabled"))
                .andExpect(jsonPath("$.correlationId").isNotEmpty());
    }

    @Test
    void draftsEndpointsReturnNotImplementedWhenFeatureFlagDisabled() throws Exception {
        mockMvc.perform(get("/api/agent/drafts"))
                .andExpect(status().isNotImplemented());

        mockMvc.perform(post("/api/agent/drafts/1/confirm"))
                .andExpect(status().isNotImplemented());

        mockMvc.perform(delete("/api/agent/drafts/1"))
                .andExpect(status().isNotImplemented());
    }
}
