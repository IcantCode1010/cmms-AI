package com.grash.service;

import com.grash.dto.agent.AgentAssetSearchRequest;
import com.grash.dto.agent.AgentToolResponse;
import com.grash.dto.agent.AgentWorkOrderSearchRequest;
import com.grash.dto.agent.AgentWorkOrderSummary;
import com.grash.dto.agent.AgentWorkOrderStatusUpdateRequest;
import com.grash.dto.agent.AgentWorkOrderStatusUpdateResponse;
import com.grash.exception.CustomException;
import com.grash.model.Asset;
import com.grash.model.Company;
import com.grash.model.OwnUser;
import com.grash.model.Labor;
import com.grash.model.WorkOrder;
import com.grash.model.Role;
import com.grash.model.WorkOrderHistory;
import com.grash.model.enums.Priority;
import com.grash.model.enums.PermissionEntity;
import com.grash.model.enums.RoleCode;
import com.grash.model.enums.Status;
import com.grash.repository.AssetRepository;
import com.grash.repository.WorkOrderRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

import java.util.Collections;
import java.util.Date;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AgentToolServiceTest {

    @Mock
    private WorkOrderRepository workOrderRepository;
    @Mock
    private AssetRepository assetRepository;
    @Mock
    private WorkOrderService workOrderService;
    @Mock
    private LaborService laborService;
    @Mock
    private TaskService taskService;
    @Mock
    private WorkOrderHistoryService workOrderHistoryService;
    @Mock
    private NotificationService notificationService;
    @Mock
    private FileService fileService;

    private AgentToolService agentToolService;

    @BeforeEach
    void setUp() {
        agentToolService = new AgentToolService(workOrderRepository, assetRepository, workOrderService,
                laborService, taskService, workOrderHistoryService, notificationService, fileService);
    }

    @Test
    void searchWorkOrdersReturnsSummaries() {
        OwnUser user = buildUser(7L, 11L);
        AgentWorkOrderSearchRequest request = new AgentWorkOrderSearchRequest();
        request.setLimit(3);
        request.setSearch("HVAC");
        request.setStatuses(Collections.singletonList("open"));

        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(42L);
        workOrder.setCustomId("WO-42");
        workOrder.setTitle("Inspect HVAC filters");
        workOrder.setStatus(Status.OPEN);
        workOrder.setPriority(Priority.HIGH);
        workOrder.setCompany(user.getCompany());
        Asset linkedAsset = new Asset();
        linkedAsset.setName("HQ HVAC-1");
        workOrder.setAsset(linkedAsset);

        when(workOrderRepository.findAll(Mockito.<Specification<WorkOrder>>any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(Collections.singletonList(workOrder)));

        AgentToolResponse<AgentWorkOrderSummary> response = agentToolService.searchWorkOrders(user, request);

        assertThat(response.getTotal()).isEqualTo(1);
        assertThat(response.getResults()).hasSize(1);
        AgentWorkOrderSummary summary = response.getResults().get(0);
        assertThat(summary.getId()).isEqualTo(42L);
        assertThat(summary.getCode()).isEqualTo("WO-42");
        assertThat(summary.getAsset()).isEqualTo("HQ HVAC-1");
        assertThat(summary.getStatus()).isEqualTo("OPEN");

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(workOrderRepository).findAll(Mockito.<Specification<WorkOrder>>any(), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(3);
    }

    @Test
    void searchAssetsDefaultsLimit() {
        OwnUser user = buildUser(3L, 21L);
        AgentAssetSearchRequest request = new AgentAssetSearchRequest();

        Asset asset = new Asset();
        asset.setId(9L);
        asset.setName("Main Pump");
        asset.setCustomId("A-009");
        asset.setCompany(user.getCompany());

        when(assetRepository.findAll(Mockito.<Specification<Asset>>any(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(Collections.singletonList(asset)));

        AgentToolResponse<?> response = agentToolService.searchAssets(user, request);
        assertThat(response.getTotal()).isEqualTo(1);
        assertThat(response.getResults()).hasSize(1);

        ArgumentCaptor<Pageable> pageableCaptor = ArgumentCaptor.forClass(Pageable.class);
        verify(assetRepository).findAll(Mockito.<Specification<Asset>>any(), pageableCaptor.capture());
        assertThat(pageableCaptor.getValue().getPageSize()).isEqualTo(5);
    }

    @Test
    void updateWorkOrderStatusMovesToInProgress() {
        OwnUser actor = buildUser(10L, 55L);
        OwnUser teammate = buildUser(11L, 55L);
        teammate.setCompany(actor.getCompany());
        teammate.setEnabled(true);

        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(500L);
        workOrder.setCompany(actor.getCompany());
        workOrder.setStatus(Status.OPEN);
        workOrder.setTitle("Replace bearings");
        workOrder.setPrimaryUser(teammate);

        when(workOrderService.findByIdAndCompany(500L, 55L)).thenReturn(Optional.of(workOrder));
        when(taskService.findByWorkOrder(500L)).thenReturn(Collections.emptyList());
        when(laborService.findByWorkOrder(500L)).thenReturn(Collections.emptyList());
        when(laborService.create(any(Labor.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(workOrderService.saveAndFlush(workOrder)).thenAnswer(invocation -> {
            workOrder.setUpdatedAt(new Date());
            return workOrder;
        });
        when(workOrderHistoryService.create(any(WorkOrderHistory.class)))
                .thenAnswer(invocation -> invocation.getArgument(0));

        AgentWorkOrderStatusUpdateRequest request = new AgentWorkOrderStatusUpdateRequest();
        request.setWorkOrderId("500");
        request.setNewStatus("IN_PROGRESS");
        request.setNotes("Technician starting work");

        AgentWorkOrderStatusUpdateResponse response = agentToolService.updateWorkOrderStatus(actor, request);

        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getWorkOrder().getPreviousStatus()).isEqualTo("OPEN");
        assertThat(response.getWorkOrder().getNewStatus()).isEqualTo("IN_PROGRESS");
        assertThat(response.getWorkOrder().getNotes()).isEqualTo("Technician starting work");
        assertThat(workOrder.getStatus()).isEqualTo(Status.IN_PROGRESS);
        verify(laborService).create(any(Labor.class));
        verify(workOrderHistoryService).create(any(WorkOrderHistory.class));
    }

    @Test
    void updateWorkOrderStatusRequiresReasonForOnHold() {
        OwnUser user = buildUser(12L, 77L);
        WorkOrder workOrder = new WorkOrder();
        workOrder.setId(600L);
        workOrder.setCompany(user.getCompany());
        workOrder.setStatus(Status.IN_PROGRESS);
        workOrder.setTitle("Repair unit");

        when(workOrderService.findByIdAndCompany(600L, 77L)).thenReturn(Optional.of(workOrder));

        AgentWorkOrderStatusUpdateRequest request = new AgentWorkOrderStatusUpdateRequest();
        request.setWorkOrderId("600");
        request.setNewStatus("ON_HOLD");

        assertThatThrownBy(() -> agentToolService.updateWorkOrderStatus(user, request))
                .isInstanceOf(CustomException.class)
                .hasMessageContaining("Reason code required");

        verify(workOrderService, never()).saveAndFlush(any());
    }

    private OwnUser buildUser(long userId, long companyId) {
        Company company = new Company();
        company.setId(companyId);

        OwnUser user = new OwnUser();
        user.setId(userId);
        user.setCompany(company);
        user.setFirstName("Test");
        user.setLastName("User");
        user.setEmail("test@example.com");
        Role role = new Role();
        role.setCode(RoleCode.ADMIN);
        role.setName("ADMIN");
        role.getEditOtherPermissions().add(PermissionEntity.WORK_ORDERS);
        user.setRole(role);
        user.setEnabled(true);
        return user;
    }
}

