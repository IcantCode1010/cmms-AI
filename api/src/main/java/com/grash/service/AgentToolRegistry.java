package com.grash.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grash.model.OwnUser;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class AgentToolRegistry {

    private final ObjectMapper objectMapper;

    public String serializeArguments(Map<String, Object> args) {
        if (args == null || args.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(args);
        } catch (Exception exception) {
            log.warn("Failed to serialise tool arguments", exception);
            return null;
        }
    }

    public Map<String, Object> getUserContext(OwnUser user) {
        if (user == null) {
            return Collections.emptyMap();
        }
        Map<String, Object> context = new HashMap<>();
        context.put("userId", user.getId());
        context.put("email", user.getEmail());
        context.put("fullName", user.getFullName());
        if (user.getRole() != null) {
            context.put("role", user.getRole().getName());
        }
        context.put("companyId", user.getCompany() != null ? user.getCompany().getId() : null);
        return context;
    }
}
