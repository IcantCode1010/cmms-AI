package com.grash.service;

import com.grash.dto.agent.AgentAssetSearchRequest;
import com.grash.dto.agent.AgentToolResponse;
import com.grash.dto.agent.AgentWorkOrderSearchRequest;
import com.grash.dto.agent.AgentWorkOrderSummary;
import com.grash.dto.agent.AgentWorkOrderStatusUpdateRequest;
import com.grash.dto.agent.AgentWorkOrderStatusUpdateResponse;
import com.grash.dto.agent.AgentWorkOrderUpdateRequest;
import com.grash.dto.agent.AgentWorkOrderUpdateResponse;
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
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
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
@MockitoSettings(strictness = Strictness.LENIENT)
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
    @Mock
    private UserService userService;
    @Mock
    private LocationService locationService;
    @Mock
    private AssetService assetService;
    @Mock
    private TeamService teamService;
    @Mock
    private WorkOrderCategoryService workOrderCategoryService;

    private AgentToolService agentToolService;

    @BeforeEach
    void setUp() {
        agentToolService = new AgentToolService(workOrderRepository, assetRepository, workOrderService,
                laborService, taskService, workOrderHistoryService, notificationService, fileService,
                userService, locationService, assetService, teamService, workOrderCategoryService);
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

    @Test
    void updateWorkOrderPreservesDescriptionWhenOnlyAssigning() {
        // Given: A work order with existing description
        OwnUser user = buildUser(100L, 50L);
        OwnUser assignee = buildUser(101L, 50L);
        assignee.setCompany(user.getCompany());
        assignee.setFirstName("Jane");
        assignee.setLastName("Doe");

        WorkOrder existingWorkOrder = new WorkOrder();
        existingWorkOrder.setId(200L);
        existingWorkOrder.setCustomId("WO-200");
        existingWorkOrder.setTitle("Fix pump");
        existingWorkOrder.setDescription("Original description that should be preserved");
        existingWorkOrder.setStatus(Status.OPEN);
        existingWorkOrder.setPriority(Priority.LOW);
        existingWorkOrder.setCompany(user.getCompany());

        // Mock repository finding the work order
        when(workOrderRepository.findByIdAndCompany_Id(200L, 50L))
                .thenReturn(Optional.of(existingWorkOrder));
        when(workOrderRepository.findByCustomIdIgnoreCaseAndCompany_Id("WO-200", 50L))
                .thenReturn(Optional.of(existingWorkOrder));

        // Mock user service for assignee lookup
        when(userService.findById(101L)).thenReturn(Optional.of(assignee));

        // Mock save operation
        when(workOrderService.saveAndFlush(any(WorkOrder.class))).thenAnswer(invocation -> {
            WorkOrder wo = invocation.getArgument(0);
            wo.setUpdatedAt(new Date());
            return wo;
        });

        // When: Update request only contains primaryUserId (no description field)
        AgentWorkOrderUpdateRequest updateRequest = AgentWorkOrderUpdateRequest.builder()
                .primaryUserId(Optional.of(101L))
                .build();

        AgentWorkOrderUpdateResponse response = agentToolService.updateWorkOrder(user, "WO-200", updateRequest);

        // Then: Description should be preserved
        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getWorkOrder().getDescription()).isEqualTo("Original description that should be preserved");
        assertThat(response.getWorkOrder().getPrimaryUserName()).isEqualTo("Jane Doe");
        assertThat(response.getUpdatedFields()).containsExactly("primaryUser");

        // Verify the work order was saved with preserved description
        ArgumentCaptor<WorkOrder> woCaptor = ArgumentCaptor.forClass(WorkOrder.class);
        verify(workOrderService).saveAndFlush(woCaptor.capture());
        WorkOrder savedWO = woCaptor.getValue();
        assertThat(savedWO.getDescription()).isEqualTo("Original description that should be preserved");
        assertThat(savedWO.getPrimaryUser()).isEqualTo(assignee);

        // Verify history was created
        verify(workOrderHistoryService).create(any(WorkOrderHistory.class));
    }

    @Test
    void updateWorkOrderAllowsIntentionalDescriptionClearing() {
        // Given: A work order with existing description
        OwnUser user = buildUser(100L, 50L);

        WorkOrder existingWorkOrder = new WorkOrder();
        existingWorkOrder.setId(201L);
        existingWorkOrder.setCustomId("WO-201");
        existingWorkOrder.setTitle("Task with description");
        existingWorkOrder.setDescription("Old description to be cleared");
        existingWorkOrder.setCompany(user.getCompany());

        when(workOrderRepository.findByIdAndCompany_Id(201L, 50L))
                .thenReturn(Optional.of(existingWorkOrder));

        when(workOrderService.saveAndFlush(any(WorkOrder.class))).thenAnswer(invocation -> {
            WorkOrder wo = invocation.getArgument(0);
            wo.setUpdatedAt(new Date());
            return wo;
        });

        // When: Update request explicitly sets description to null
        AgentWorkOrderUpdateRequest updateRequest = AgentWorkOrderUpdateRequest.builder()
                .description(Optional.of(null))  // Explicitly clearing
                .build();

        AgentWorkOrderUpdateResponse response = agentToolService.updateWorkOrder(user, "201", updateRequest);

        // Then: Description should be cleared
        assertThat(response.isSuccess()).isTrue();
        assertThat(response.getWorkOrder().getDescription()).isNull();
        assertThat(response.getUpdatedFields()).containsExactly("description");

        // Verify the work order was saved with null description
        ArgumentCaptor<WorkOrder> woCaptor = ArgumentCaptor.forClass(WorkOrder.class);
        verify(workOrderService).saveAndFlush(woCaptor.capture());
        assertThat(woCaptor.getValue().getDescription()).isNull();
    }
}

