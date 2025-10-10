package com.grash.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.grash.configuration.AgentProperties;
import com.grash.dto.agent.AgentRuntimeRequest;
import com.grash.dto.agent.AgentRuntimeResponse;
import com.grash.exception.AgentRuntimeException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.time.Duration;

@Component
@RequiredArgsConstructor
@Slf4j
public class AgentRuntimeClient {

    private static final MediaType JSON = MediaType.parse("application/json; charset=utf-8");
    private final AgentProperties agentProperties;
    private final ObjectMapper objectMapper;
    private OkHttpClient httpClient;

    public AgentRuntimeResponse sendPrompt(AgentRuntimeRequest request, String correlationId) {
        if (!StringUtils.hasText(agentProperties.getRuntimeUrl())) {
            throw new AgentRuntimeException("Agent runtime URL is not configured");
        }

        OkHttpClient client = getHttpClient();
        String endpoint = buildEndpoint(agentProperties.getRuntimeUrl());
        try {
            RequestBody body = RequestBody.create(objectMapper.writeValueAsBytes(request), JSON);
            Request.Builder builder = new Request.Builder()
                    .url(endpoint)
                    .post(body)
                    .header("Content-Type", "application/json")
                    .header("X-Correlation-Id", correlationId);

            if (StringUtils.hasText(agentProperties.getRuntimeToken())) {
                builder.header("Authorization", "Bearer " + agentProperties.getRuntimeToken());
            }

            try (Response response = client.newCall(builder.build()).execute()) {
                String responseBody = response.body() != null ? response.body().string() : "";
                if (!response.isSuccessful()) {
                    log.error("Agent runtime returned non-success status {}", response.code());
                    throw new AgentRuntimeException("Agent runtime responded with status " + response.code());
                }

                if (!StringUtils.hasText(responseBody)) {
                    throw new AgentRuntimeException("Agent runtime returned an empty body");
                }

                AgentRuntimeResponse runtimeResponse =
                        objectMapper.readValue(responseBody, AgentRuntimeResponse.class);
                if (!StringUtils.hasText(runtimeResponse.getStatus())) {
                    runtimeResponse.setStatus("success");
                }
                return runtimeResponse;
            }
        } catch (IOException exception) {
            throw new AgentRuntimeException("Failed to communicate with agent runtime", exception);
        }
    }

    private String buildEndpoint(String baseUrl) {
        if (baseUrl.endsWith("/")) {
            return baseUrl + "v1/chat";
        }
        return baseUrl + "/v1/chat";
    }

    private synchronized OkHttpClient getHttpClient() {
        if (httpClient == null) {
            Duration timeout = Duration.ofMillis(
                    agentProperties.getTimeoutMs() != null ? agentProperties.getTimeoutMs() : 30000);
            httpClient = new OkHttpClient.Builder()
                    .callTimeout(timeout)
                    .readTimeout(timeout)
                    .writeTimeout(timeout)
                    .build();
        }
        return httpClient;
    }
}
