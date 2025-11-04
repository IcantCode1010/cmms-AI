package com.grash.controller;

import com.grash.configuration.AgentProperties;
import com.grash.dto.agent.AgentAssetSearchRequest;
import com.grash.dto.agent.AgentAssetSummary;
import com.grash.dto.agent.AgentToolResponse;
import com.grash.dto.agent.AgentWorkOrderCreateRequest;
import com.grash.dto.agent.AgentWorkOrderCreateResponse;
import com.grash.dto.agent.AgentWorkOrderDetails;
import com.grash.dto.agent.AgentWorkOrderStatusUpdateRequest;
import com.grash.dto.agent.AgentWorkOrderStatusUpdateResponse;
import com.grash.dto.agent.AgentWorkOrderSearchRequest;
import com.grash.dto.agent.AgentWorkOrderSummary;
import com.grash.model.OwnUser;
import com.grash.service.AgentToolService;
import com.grash.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import javax.servlet.http.HttpServletRequest;
import javax.validation.Valid;

@RestController
@RequestMapping("/api/agent/tools")
@RequiredArgsConstructor
@Validated
public class AgentToolController {

    private final AgentProperties agentProperties;
    private final AgentToolService agentToolService;
    private final UserService userService;

    @PostMapping("/work-orders/create")
    public ResponseEntity<com.grash.dto.agent.AgentWorkOrderCreateResponse> createWorkOrder(
            HttpServletRequest httpRequest,
            @Valid @RequestBody com.grash.dto.agent.AgentWorkOrderCreateRequest createRequest) {
        if (!agentProperties.isChatkitEnabled()) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
        OwnUser user = userService.whoami(httpRequest);
        com.grash.dto.agent.AgentWorkOrderCreateResponse response = agentToolService.createWorkOrder(user, createRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/work-orders/update-status")
    public ResponseEntity<AgentWorkOrderStatusUpdateResponse> updateWorkOrderStatus(
            HttpServletRequest httpRequest,
            @Valid @RequestBody AgentWorkOrderStatusUpdateRequest statusRequest) {
        if (!agentProperties.isChatkitEnabled()) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
        OwnUser user = userService.whoami(httpRequest);
        AgentWorkOrderStatusUpdateResponse response = agentToolService.updateWorkOrderStatus(user, statusRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/work-orders/search")
    public ResponseEntity<AgentToolResponse<AgentWorkOrderSummary>> searchWorkOrders(
            HttpServletRequest httpRequest,
            @Valid @RequestBody AgentWorkOrderSearchRequest searchRequest) {
        if (!agentProperties.isChatkitEnabled()) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
        OwnUser user = userService.whoami(httpRequest);
        AgentToolResponse<AgentWorkOrderSummary> response = agentToolService.searchWorkOrders(user, searchRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/assets/search")
    public ResponseEntity<AgentToolResponse<AgentAssetSummary>> searchAssets(
            HttpServletRequest httpRequest,
            @Valid @RequestBody AgentAssetSearchRequest searchRequest) {
        if (!agentProperties.isChatkitEnabled()) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
        OwnUser user = userService.whoami(httpRequest);
        AgentToolResponse<AgentAssetSummary> response = agentToolService.searchAssets(user, searchRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/work-orders/{id}/details")
    public ResponseEntity<AgentWorkOrderDetails> getWorkOrderDetails(
            HttpServletRequest httpRequest,
            @PathVariable("id") String workOrderId) {
        if (!agentProperties.isChatkitEnabled()) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
        OwnUser user = userService.whoami(httpRequest);
        AgentWorkOrderDetails details = agentToolService.getWorkOrderDetails(user, workOrderId);
        return ResponseEntity.ok(details);
    }

    @PostMapping("/work-orders/{id}/update")
    public ResponseEntity<com.grash.dto.agent.AgentWorkOrderUpdateResponse> updateWorkOrder(
            HttpServletRequest httpRequest,
            @PathVariable("id") String workOrderId,
            @Valid @RequestBody com.grash.dto.agent.AgentWorkOrderUpdateRequest updateRequest) {
        if (!agentProperties.isChatkitEnabled()) {
            return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
        }
        OwnUser user = userService.whoami(httpRequest);
        com.grash.dto.agent.AgentWorkOrderUpdateResponse response = agentToolService.updateWorkOrder(user, workOrderId, updateRequest);
        return ResponseEntity.ok(response);
    }
}
