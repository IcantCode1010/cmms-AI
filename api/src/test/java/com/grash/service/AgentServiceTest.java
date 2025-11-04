package com.grash.service;

import com.grash.configuration.AgentProperties;
import com.grash.dto.agent.AgentRuntimeDraft;
import com.grash.repository.AgentDraftActionRepository;
import com.grash.repository.AgentToolInvocationLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

@ExtendWith(MockitoExtension.class)
class AgentServiceTest {

    @Mock
    private AgentProperties agentProperties;
    @Mock
    private AgentToolInvocationLogRepository invocationLogRepository;
    @Mock
    private AgentToolRegistry agentToolRegistry;
    @Mock
    private AgentRuntimeClient agentRuntimeClient;
    @Mock
    private AgentDraftActionRepository draftActionRepository;

    private AgentService agentService;

    @BeforeEach
    void setUp() {
        agentService = new AgentService(
                agentProperties,
                invocationLogRepository,
                agentToolRegistry,
                agentRuntimeClient,
                draftActionRepository
        );
    }

    @Test
    void buildDraftPayloadFlattensNestedData() throws Exception {
        Map<String, Object> innerData = new HashMap<>();
        innerData.put("title", "Down Network Connection Router");
        innerData.put("description", "A network connection router is down in building fifty-five.");
        innerData.put("priority", "LOW");

        Map<String, Object> runtimePayload = new HashMap<>();
        runtimePayload.put("summary", "Create work order: Down Network Connection Router");
        runtimePayload.put("data", innerData);

        AgentRuntimeDraft draft = AgentRuntimeDraft.builder()
                .summary("Create work order: Down Network Connection Router")
                .payload(runtimePayload)
                .build();

        Map<String, Object> flattened = invokeBuildDraftPayload(draft);

        assertEquals("Create work order: Down Network Connection Router", flattened.get("summary"));
        assertTrue(flattened.get("data") instanceof Map);

        Map<String, Object> data = (Map<String, Object>) flattened.get("data");
        assertEquals("Down Network Connection Router", data.get("title"));
        assertEquals("A network connection router is down in building fifty-five.", data.get("description"));
        assertEquals("LOW", data.get("priority"));
        assertFalse(data.containsKey("data"), "Data map should not contain nested data entry");
    }

    @Test
    void buildDraftPayloadFallsBackWhenNoNestedData() throws Exception {
        Map<String, Object> runtimePayload = new HashMap<>();
        runtimePayload.put("title", "Inspect Generator");
        runtimePayload.put("priority", "MEDIUM");

        AgentRuntimeDraft draft = AgentRuntimeDraft.builder()
                .summary("Inspect Generator")
                .payload(runtimePayload)
                .build();

        Map<String, Object> flattened = invokeBuildDraftPayload(draft);

        assertEquals("Inspect Generator", flattened.get("summary"));

        Map<String, Object> data = (Map<String, Object>) flattened.get("data");
        assertEquals("Inspect Generator", data.get("title"));
        assertEquals("MEDIUM", data.get("priority"));
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> invokeBuildDraftPayload(AgentRuntimeDraft draft) throws Exception {
        Method method = AgentService.class.getDeclaredMethod("buildDraftPayload", AgentRuntimeDraft.class);
        method.setAccessible(true);
        return (Map<String, Object>) method.invoke(agentService, draft);
    }
}
