#!/usr/bin/env python3
"""
Generate a ROS YAML template from a recommendation JSON.

Usage:
    python generate_ros_template.py --recommendation recommendation.json --output stack.yml
    echo '{"pattern":"standard",...}' | python generate_ros_template.py --output stack.yml

Reads the recommendation (from analyze_requirements.py) and assembles a deployable
ROS template by composing base fragments.

Supported patterns: lite, standard, ha, elastic, serverless, container
Reference: references/solution-patterns.md, references/resource-reference.md
"""

import argparse
import json
import sys
import os

SKILL_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROS_TEMPLATES_DIR = r"C:\work\ros-templates"
ASSETS_DIR = os.path.join(SKILL_DIR, "assets", "ros-base-templates")


# ---------------------------------------------------------------------------
# Helper: extract specs from recommendation
# ---------------------------------------------------------------------------

def _get_spec(rec, service_key, default):
    for item in rec.get("cost_breakdown", []):
        if service_key in item.get("service", ""):
            return item.get("spec", default)
    return default


def _get_db_engine(rec):
    engine = "MySQL"
    for item in rec.get("cost_breakdown", []):
        svc = item.get("service", "")
        if "RDS" in svc:
            if "PG" in svc or "postgresql" in svc.lower():
                engine = "PostgreSQL"
    db_req = rec.get("requirements", {}).get("db", "mysql")
    if db_req == "postgresql":
        engine = "PostgreSQL"
    return engine


# ---------------------------------------------------------------------------
# Fragment: Header
# ---------------------------------------------------------------------------

def header(description_zh, description_en):
    return f"""ROSTemplateFormatVersion: '2015-09-01'
Description:
  zh-cn: {description_zh}
  en: {description_en}
"""


# ---------------------------------------------------------------------------
# Fragment: Parameters
# ---------------------------------------------------------------------------

def params_common():
    return """Parameters:
  ZoneId:
    Type: String
    Label:
      en: Availability Zone
      zh-cn: 可用区
    AssociationProperty: ALIYUN::ECS::Instance::ZoneId

  PayType:
    Type: String
    Label:
      en: ECS Instance Charge Type
      zh-cn: 付费类型
    Default: PostPaid
    AllowedValues:
      - PostPaid
      - PrePaid
"""


def params_zone2():
    """Second availability zone for multi-AZ deployments."""
    return """
  ZoneId2:
    Type: String
    Label:
      en: Availability Zone 2
      zh-cn: 可用区2
    AssociationProperty: ALIYUN::ECS::Instance::ZoneId
"""


def params_ecs(spec="ecs.c6.large"):
    return f"""
  EcsInstanceType:
    Type: String
    Label:
      en: Instance Type
      zh-cn: 实例规格
    Default: '{spec}'
    AssociationProperty: ALIYUN::ECS::Instance::InstanceType

  EcsPassword:
    Type: String
    Label:
      en: Instance Password
      zh-cn: 实例密码
    NoEcho: true
    MinLength: 8
    MaxLength: 30

  EcsDiskSize:
    Type: Number
    Label:
      en: System Disk Size (GB)
      zh-cn: 系统盘大小(GB)
    Default: 40
    MinValue: 20
    MaxValue: 500
"""


def params_rds(spec="rds.mysql.s1.small", engine="MySQL", storage=20):
    return f"""
  RdsInstanceClass:
    Type: String
    Label:
      en: RDS Instance Class
      zh-cn: RDS实例规格
    Default: '{spec}'

  RdsEngine:
    Type: String
    Default: '{engine}'

  RdsStorageSize:
    Type: Number
    Label:
      en: RDS Storage Size (GB)
      zh-cn: RDS存储空间(GB)
    Default: {storage}
    MinValue: 20
    MaxValue: 2000

  RdsAccountName:
    Type: String
    Label:
      en: Database Account Name
      zh-cn: 数据库账号名
    Default: 'dbadmin'

  RdsAccountPassword:
    Type: String
    Label:
      en: Database Account Password
      zh-cn: 数据库账号密码
    NoEcho: true
    MinLength: 8
"""


def params_redis():
    return """
  RedisInstanceClass:
    Type: String
    Label:
      en: Redis Instance Class
      zh-cn: Redis实例规格
    Default: 'redis.master.small.default'

  RedisPassword:
    Type: String
    Label:
      en: Redis Password
      zh-cn: Redis密码
    NoEcho: true
    MinLength: 8
"""


def params_polardb(spec="polar.mysql.x4.medium"):
    return f"""
  PolarDBNodeClass:
    Type: String
    Label:
      en: PolarDB Node Class
      zh-cn: PolarDB节点规格
    Default: '{spec}'

  PolarDBAccountName:
    Type: String
    Label:
      en: PolarDB Account Name
      zh-cn: PolarDB账号名
    Default: 'dbadmin'

  PolarDBAccountPassword:
    Type: String
    Label:
      en: PolarDB Account Password
      zh-cn: PolarDB账号密码
    NoEcho: true
    MinLength: 8
"""


def params_k8s():
    return """
  K8sWorkerInstanceType:
    Type: String
    Label:
      en: Worker Instance Type
      zh-cn: Worker节点规格
    Default: 'ecs.c6.xlarge'
    AssociationProperty: ALIYUN::ECS::Instance::InstanceType

  K8sLoginPassword:
    Type: String
    Label:
      en: K8s Node Login Password
      zh-cn: K8s节点登录密码
    NoEcho: true
    MinLength: 8
    MaxLength: 30

  K8sNumOfNodes:
    Type: Number
    Label:
      en: Number of Worker Nodes
      zh-cn: Worker节点数量
    Default: 3
    MinValue: 1
    MaxValue: 100
"""


def params_fc():
    return """
  FcServiceName:
    Type: String
    Label:
      en: FC Service Name
      zh-cn: FC服务名称
    Default: 'app-service'

  FcFunctionName:
    Type: String
    Label:
      en: FC Function Name
      zh-cn: FC函数名称
    Default: 'app-handler'

  FcRuntime:
    Type: String
    Label:
      en: FC Runtime
      zh-cn: FC运行时
    Default: 'nodejs16'
    AllowedValues:
      - nodejs14
      - nodejs16
      - python3
      - python3.9
      - java11
      - go1
      - custom

  FcMemorySize:
    Type: Number
    Label:
      en: FC Memory (MB)
      zh-cn: FC内存(MB)
    Default: 512
    MinValue: 128
    MaxValue: 32768
"""


# ---------------------------------------------------------------------------
# Fragment: Resources - Network
# ---------------------------------------------------------------------------

def resources_vpc():
    return """
Resources:
  Vpc:
    Type: ALIYUN::ECS::VPC
    Properties:
      VpcName:
        Fn::Sub: '${ALIYUN::StackName}-vpc'
      CidrBlock: 192.168.0.0/16

  VSwitch:
    Type: ALIYUN::ECS::VSwitch
    Properties:
      ZoneId:
        Ref: ZoneId
      VpcId:
        Ref: Vpc
      VSwitchName:
        Fn::Sub: '${ALIYUN::StackName}-vsw'
      CidrBlock: 192.168.1.0/24

  SecurityGroup:
    Type: ALIYUN::ECS::SecurityGroup
    Properties:
      VpcId:
        Ref: Vpc
      SecurityGroupName:
        Fn::Sub: '${ALIYUN::StackName}-sg'
      SecurityGroupIngress:
        - PortRange: 80/80
          IpProtocol: tcp
          SourceCidrIp: 0.0.0.0/0
        - PortRange: 443/443
          IpProtocol: tcp
          SourceCidrIp: 0.0.0.0/0
        - PortRange: 22/22
          IpProtocol: tcp
          SourceCidrIp: 0.0.0.0/0
"""


def resource_vswitch2():
    """Second VSwitch for multi-AZ deployments."""
    return """
  VSwitch2:
    Type: ALIYUN::ECS::VSwitch
    Properties:
      ZoneId:
        Ref: ZoneId2
      VpcId:
        Ref: Vpc
      VSwitchName:
        Fn::Sub: '${ALIYUN::StackName}-vsw2'
      CidrBlock: 192.168.2.0/24
"""


def resource_nat_eip_snat():
    """NAT Gateway + EIP + SNAT for outbound access (ACK worker nodes)."""
    return """
  NatGateway:
    Type: ALIYUN::VPC::NatGateway
    Properties:
      VpcId:
        Ref: Vpc
      VSwitchId:
        Ref: VSwitch
      NatGatewayName:
        Fn::Sub: '${ALIYUN::StackName}-nat'
      NatType: Enhanced
      InternetChargeType: PayByLcu

  NatEip:
    Type: ALIYUN::VPC::EIP
    Properties:
      Bandwidth: 10
      InternetChargeType: PayByTraffic

  NatEipAssociation:
    Type: ALIYUN::VPC::EIPAssociation
    Properties:
      AllocationId:
        Fn::GetAtt:
          - NatEip
          - AllocationId
      InstanceId:
        Ref: NatGateway
    DependsOn:
      - NatGateway
      - NatEip

  SnatEntry:
    Type: ALIYUN::ECS::SNatEntry
    Properties:
      SNatTableId:
        Fn::GetAtt:
          - NatGateway
          - SNatTableId
      SNatIp:
        Fn::GetAtt:
          - NatEip
          - EipAddress
      SourceVSwitchId:
        Ref: VSwitch
    DependsOn: NatEipAssociation
"""


# ---------------------------------------------------------------------------
# Fragment: Resources - Compute
# ---------------------------------------------------------------------------

def resource_ecs():
    return """
  EcsInstance:
    Type: ALIYUN::ECS::Instance
    Properties:
      VpcId:
        Ref: Vpc
      VSwitchId:
        Ref: VSwitch
      SecurityGroupId:
        Ref: SecurityGroup
      ZoneId:
        Ref: ZoneId
      InstanceType:
        Ref: EcsInstanceType
      InstanceChargeType:
        Ref: PayType
      ImageId: aliyun_3_x64_20G_alibase_20240819.vhd
      SystemDiskCategory: cloud_essd
      SystemDiskSize:
        Ref: EcsDiskSize
      Password:
        Ref: EcsPassword
      AllocatePublicIP: true
      InternetMaxBandwidthOut: 5
      InstanceName:
        Fn::Sub: '${ALIYUN::StackName}-ecs'
"""


def resource_ecs_group(count=2, public_ip=False):
    """ECS InstanceGroup for HA deployments (multi-instance)."""
    bw = 5 if public_ip else 0
    alloc = "true" if public_ip else "false"
    return f"""
  EcsInstanceGroup:
    Type: ALIYUN::ECS::InstanceGroup
    Properties:
      VpcId:
        Ref: Vpc
      VSwitchId:
        Ref: VSwitch
      SecurityGroupId:
        Ref: SecurityGroup
      ZoneId:
        Ref: ZoneId
      InstanceType:
        Ref: EcsInstanceType
      InstanceChargeType:
        Ref: PayType
      ImageId: aliyun_3_x64_20G_alibase_20240819.vhd
      SystemDiskCategory: cloud_essd
      SystemDiskSize:
        Ref: EcsDiskSize
      Password:
        Ref: EcsPassword
      MaxAmount: {count}
      MinAmount: {count}
      AllocatePublicIP: {alloc}
      InternetMaxBandwidthOut: {bw}
      InstanceName:
        Fn::Sub: '${{ALIYUN::StackName}}-ecs-[postfix]'
"""


def resource_run_command():
    """RunCommand placeholder - user fills in deployment script."""
    return """
  DeployCommand:
    Type: ALIYUN::ECS::RunCommand
    Properties:
      InstanceIds:
        - Ref: EcsInstance
      Type: RunShellScript
      Sync: true
      Timeout: 600
      CommandContent:
        Fn::Sub: |
          #!/bin/bash
          echo "=== Deployment placeholder ==="
          echo "Replace this with your deployment script"
          echo "ECS Instance: ${ALIYUN::StackName}"
    DependsOn: EcsInstance
"""


# ---------------------------------------------------------------------------
# Fragment: Resources - Database
# ---------------------------------------------------------------------------

def resource_rds(category="Basic"):
    return f"""
  RdsInstance:
    Type: ALIYUN::RDS::DBInstance
    Properties:
      VpcId:
        Ref: Vpc
      VSwitchId:
        Ref: VSwitch
      ZoneId:
        Ref: ZoneId
      Engine:
        Ref: RdsEngine
      EngineVersion: '8.0'
      DBInstanceClass:
        Ref: RdsInstanceClass
      DBInstanceStorage:
        Ref: RdsStorageSize
      DBInstanceStorageType: cloud_essd
      SecurityIPList: 192.168.0.0/16
      DBInstanceNetType: Intranet
      PayType:
        Ref: PayType
      Category: {category}

  RdsDatabase:
    Type: ALIYUN::RDS::Database
    Properties:
      DBInstanceId:
        Ref: RdsInstance
      DBName:
        Fn::Sub: '${{ALIYUN::StackName}}_db'
      CharacterSetName: utf8mb4

  RdsAccount:
    Type: ALIYUN::RDS::Account
    DependsOn: RdsDatabase
    Properties:
      DBInstanceId:
        Ref: RdsInstance
      AccountName:
        Ref: RdsAccountName
      AccountPassword:
        Ref: RdsAccountPassword
      AccountType: Super
"""


def resource_rds_readonly():
    """Read-only replica for HA/E-Commerce patterns."""
    return """
  RdsReadOnly:
    Type: ALIYUN::RDS::ReadOnlyDBInstance
    Properties:
      DBInstanceId:
        Ref: RdsInstance
      ZoneId:
        Ref: ZoneId
      VPCId:
        Ref: Vpc
      VSwitchId:
        Ref: VSwitch
      DBInstanceClass:
        Ref: RdsInstanceClass
      DBInstanceStorage:
        Ref: RdsStorageSize
      EngineVersion: '8.0'
    DependsOn: RdsInstance
"""


def resource_polardb():
    """PolarDB cluster for elastic auto-scaling pattern."""
    return """
  PolarDBCluster:
    Type: ALIYUN::POLARDB::DBCluster
    Properties:
      VpcId:
        Ref: Vpc
      VSwitchId:
        Ref: VSwitch
      ZoneId:
        Ref: ZoneId
      DBType: MySQL
      DBVersion: '8.0'
      DBNodeClass:
        Ref: PolarDBNodeClass
      PayType: Postpaid
      ClusterNetworkType: VPC

  PolarDBAccount:
    Type: ALIYUN::POLARDB::Account
    Properties:
      DBClusterId:
        Ref: PolarDBCluster
      AccountName:
        Ref: PolarDBAccountName
      AccountPassword:
        Ref: PolarDBAccountPassword
      AccountType: Super
    DependsOn: PolarDBCluster

  PolarDBWhitelist:
    Type: ALIYUN::POLARDB::DBClusterAccessWhiteList
    Properties:
      DBClusterId:
        Ref: PolarDBCluster
      SecurityIps: 192.168.0.0/16
    DependsOn: PolarDBCluster

  PolarDBReadNode:
    Type: ALIYUN::POLARDB::DBNodes
    Properties:
      DBClusterId:
        Ref: PolarDBCluster
      Amount: 1
    DependsOn: PolarDBCluster
"""


def resource_redis():
    return """
  RedisInstance:
    Type: ALIYUN::REDIS::Instance
    Properties:
      VpcId:
        Ref: Vpc
      VSwitchId:
        Ref: VSwitch
      ZoneId:
        Ref: ZoneId
      InstanceClass:
        Ref: RedisInstanceClass
      InstanceName:
        Fn::Sub: '${ALIYUN::StackName}-redis'
      EngineVersion: '5.0'
      Password:
        Ref: RedisPassword

  RedisWhitelist:
    Type: ALIYUN::REDIS::Whitelist
    Properties:
      InstanceId:
        Ref: RedisInstance
      SecurityIps: 192.168.0.0/16
    DependsOn: RedisInstance
"""


# ---------------------------------------------------------------------------
# Fragment: Resources - Load Balancer
# ---------------------------------------------------------------------------

def resource_slb():
    return """
  Slb:
    Type: ALIYUN::SLB::LoadBalancer
    Properties:
      VpcId:
        Ref: Vpc
      VSwitchId:
        Ref: VSwitch
      LoadBalancerName:
        Fn::Sub: '${ALIYUN::StackName}-slb'
      LoadBalancerSpec: slb.s2.small
      AddressType: internet
      PayType: PayOnDemand

  SlbListener:
    Type: ALIYUN::SLB::Listener
    Properties:
      LoadBalancerId:
        Ref: Slb
      ListenerPort: 80
      BackendServerPort: 80
      Protocol: http
      Bandwidth: -1
      HealthCheck:
        HealthyThreshold: 3
        UnhealthyThreshold: 3
        Interval: 2
        Timeout: 5
        URI: /
"""


def resource_slb_backend_single():
    return """
  SlbBackendAttachment:
    Type: ALIYUN::SLB::BackendServerAttachment
    Properties:
      LoadBalancerId:
        Ref: Slb
      BackendServerList:
        - Ref: EcsInstance
"""


def resource_slb_backend_group():
    """Backend attachment for InstanceGroup (returns list of IDs)."""
    return """
  SlbBackendAttachment:
    Type: ALIYUN::SLB::BackendServerAttachment
    Properties:
      LoadBalancerId:
        Ref: Slb
      BackendServerList:
        Fn::GetAtt:
          - EcsInstanceGroup
          - InstanceIds
"""


# ---------------------------------------------------------------------------
# Fragment: Resources - Auto-Scaling (ESS)
# ---------------------------------------------------------------------------

def resource_ess():
    """ESS ScalingGroup + Configuration + Enable + Rules + Alarm."""
    return """
  ScalingGroup:
    Type: ALIYUN::ESS::ScalingGroup
    Properties:
      VSwitchId:
        Ref: VSwitch
      MinSize: 1
      MaxSize: 10
      ScalingGroupName:
        Fn::Sub: '${ALIYUN::StackName}-ess'
      LoadBalancerIds:
        - Ref: Slb

  ScalingConfiguration:
    Type: ALIYUN::ESS::ScalingConfiguration
    Properties:
      ScalingGroupId:
        Fn::GetAtt:
          - ScalingGroup
          - ScalingGroupId
      ImageId: aliyun_3_x64_20G_alibase_20240819.vhd
      InstanceType:
        Ref: EcsInstanceType
      SystemDiskCategory: cloud_essd
      SystemDiskSize:
        Ref: EcsDiskSize
      SecurityGroupId:
        Ref: SecurityGroup
      InternetMaxBandwidthOut: 0
      Password:
        Ref: EcsPassword
    DependsOn: ScalingGroup

  ScalingGroupEnable:
    Type: ALIYUN::ESS::ScalingGroupEnable
    Properties:
      ScalingGroupId:
        Fn::GetAtt:
          - ScalingGroup
          - ScalingGroupId
      ScalingConfigurationId:
        Ref: ScalingConfiguration
    DependsOn: ScalingConfiguration

  ScaleOutRule:
    Type: ALIYUN::ESS::ScalingRule
    Properties:
      ScalingGroupId:
        Fn::GetAtt:
          - ScalingGroup
          - ScalingGroupId
      AdjustmentType: QuantityChangeInCapacity
      AdjustmentValue: 1
    DependsOn: ScalingGroup

  ScaleInRule:
    Type: ALIYUN::ESS::ScalingRule
    Properties:
      ScalingGroupId:
        Fn::GetAtt:
          - ScalingGroup
          - ScalingGroupId
      AdjustmentType: QuantityChangeInCapacity
      AdjustmentValue: -1
    DependsOn: ScalingGroup

  CpuAlarmHigh:
    Type: ALIYUN::ESS::AlarmTask
    Properties:
      ScalingGroupId:
        Ref: ScalingGroup
      AlarmAction:
        - Fn::GetAtt:
            - ScaleOutRule
            - ScalingRuleAri
      MetricName: CpuUtilization
      MetricType: system
      Threshold: 70
      Statistics: Average
    DependsOn: ScaleOutRule

  CpuAlarmLow:
    Type: ALIYUN::ESS::AlarmTask
    Properties:
      ScalingGroupId:
        Ref: ScalingGroup
      AlarmAction:
        - Fn::GetAtt:
            - ScaleInRule
            - ScalingRuleAri
      MetricName: CpuUtilization
      MetricType: system
      Threshold: 30
      Statistics: Average
    DependsOn: ScaleInRule
"""


# ---------------------------------------------------------------------------
# Fragment: Resources - Serverless (FC + API Gateway)
# ---------------------------------------------------------------------------

def resource_fc():
    """FC Service + Function + HTTP Trigger."""
    return """
  FcService:
    Type: ALIYUN::FC::Service
    Properties:
      ServiceName:
        Ref: FcServiceName
      Description:
        Fn::Sub: '${ALIYUN::StackName} serverless service'

  FcFunction:
    Type: ALIYUN::FC::Function
    Properties:
      ServiceName:
        Ref: FcServiceName
      FunctionName:
        Ref: FcFunctionName
      Runtime:
        Ref: FcRuntime
      Handler: index.handler
      MemorySize:
        Ref: FcMemorySize
      Timeout: 60
      Code:
        SourceCode: |
          exports.handler = async (event, context) => {
            return { statusCode: 200, body: 'Hello from FC!' };
          };
    DependsOn: FcService

  FcTrigger:
    Type: ALIYUN::FC::Trigger
    Properties:
      ServiceName:
        Ref: FcServiceName
      FunctionName:
        Ref: FcFunctionName
      TriggerName: http-trigger
      TriggerType: http
      TriggerConfig:
        AuthType: anonymous
        Methods:
          - GET
          - POST
          - PUT
          - DELETE
    DependsOn: FcFunction
"""


def resource_apigateway():
    """API Gateway Group + App for FC backend."""
    return """
  ApiGroup:
    Type: ALIYUN::ApiGateway::Group
    Properties:
      GroupName:
        Fn::Sub: '${ALIYUN::StackName}-api'
      Description:
        Fn::Sub: 'API Gateway for ${ALIYUN::StackName}'

  ApiApp:
    Type: ALIYUN::ApiGateway::App
    Properties:
      AppName:
        Fn::Sub: '${ALIYUN::StackName}-app'
"""


# ---------------------------------------------------------------------------
# Fragment: Resources - Container (ACK)
# ---------------------------------------------------------------------------

def resource_ack():
    """Managed Kubernetes Cluster."""
    return """
  K8sCluster:
    Type: ALIYUN::CS::ManagedKubernetesCluster
    Properties:
      VpcId:
        Ref: Vpc
      VSwitchIds:
        - Ref: VSwitch
      Name:
        Fn::Sub: '${ALIYUN::StackName}-ack'
      ClusterSpec: ack.pro.small
      WorkerInstanceTypes:
        - Ref: K8sWorkerInstanceType
      WorkerSystemDiskCategory: cloud_essd
      WorkerSystemDiskSize: 120
      NumOfNodes:
        Ref: K8sNumOfNodes
      LoginPassword:
        Ref: K8sLoginPassword
      ServiceCidr: 172.16.0.0/16
      ContainerCidr: 10.0.0.0/16
      Addons:
        - Name: flannel
"""


# ---------------------------------------------------------------------------
# Fragment: Outputs
# ---------------------------------------------------------------------------

def outputs_lite():
    return """
Outputs:
  EcsPublicIp:
    Value:
      Fn::GetAtt:
        - EcsInstance
        - PublicIp
  EcsInstanceId:
    Value:
      Ref: EcsInstance
"""


def outputs_standard():
    return """
Outputs:
  EcsPublicIp:
    Value:
      Fn::GetAtt:
        - EcsInstance
        - PublicIp
  EcsInstanceId:
    Value:
      Ref: EcsInstance
  RdsInternalEndpoint:
    Value:
      Fn::GetAtt:
        - RdsInstance
        - InnerConnectionString
  RdsPort:
    Value:
      Fn::GetAtt:
        - RdsInstance
        - InnerPort
  RdsDatabaseName:
    Value:
      Fn::Sub: '${ALIYUN::StackName}_db'
  SlbPublicIp:
    Value:
      Fn::GetAtt:
        - Slb
        - IpAddress
"""


def outputs_ha():
    return """
Outputs:
  EcsInstanceIds:
    Value:
      Fn::GetAtt:
        - EcsInstanceGroup
        - InstanceIds
  EcsPrivateIps:
    Value:
      Fn::GetAtt:
        - EcsInstanceGroup
        - PrivateIps
  RdsInternalEndpoint:
    Value:
      Fn::GetAtt:
        - RdsInstance
        - InnerConnectionString
  RdsPort:
    Value:
      Fn::GetAtt:
        - RdsInstance
        - InnerPort
  RdsDatabaseName:
    Value:
      Fn::Sub: '${ALIYUN::StackName}_db'
  RdsReadOnlyEndpoint:
    Value:
      Fn::GetAtt:
        - RdsReadOnly
        - ConnectionString
  SlbPublicIp:
    Value:
      Fn::GetAtt:
        - Slb
        - IpAddress
"""


def outputs_elastic():
    return """
Outputs:
  EcsPublicIp:
    Value:
      Fn::GetAtt:
        - EcsInstance
        - PublicIp
  EcsInstanceId:
    Value:
      Ref: EcsInstance
  ScalingGroupId:
    Value:
      Fn::GetAtt:
        - ScalingGroup
        - ScalingGroupId
  PolarDBClusterId:
    Value:
      Ref: PolarDBCluster
  PolarDBEndpoint:
    Value:
      Fn::GetAtt:
        - PolarDBCluster
        - ClusterConnectionString
  RedisEndpoint:
    Value:
      Fn::GetAtt:
        - RedisInstance
        - ConnectionDomain
  SlbPublicIp:
    Value:
      Fn::GetAtt:
        - Slb
        - IpAddress
"""


def outputs_serverless():
    return """
Outputs:
  FcServiceName:
    Value:
      Ref: FcServiceName
  FcFunctionName:
    Value:
      Ref: FcFunctionName
  ApiGroupSubDomain:
    Value:
      Fn::GetAtt:
        - ApiGroup
        - SubDomain
"""


def outputs_container():
    return """
Outputs:
  K8sClusterId:
    Value:
      Fn::GetAtt:
        - K8sCluster
        - ClusterId
  K8sTaskId:
    Value:
      Fn::GetAtt:
        - K8sCluster
        - TaskId
  NatEipAddress:
    Value:
      Fn::GetAtt:
        - NatEip
        - EipAddress
"""


# ===========================================================================
# Generators per pattern
# ===========================================================================

def generate_lite(rec):
    ecs_spec = _get_spec(rec, "ECS", "ecs.t6-c1m2.large")
    return (
        header("单机ECS部署 - 自动生成", "Single ECS deployment - auto generated")
        + params_common()
        + params_ecs(ecs_spec)
        + resources_vpc()
        + resource_ecs()
        + outputs_lite()
    )


def generate_standard(rec):
    ecs_spec = _get_spec(rec, "ECS", "ecs.c6.large")
    rds_spec = _get_spec(rec, "RDS", "rds.mysql.s1.small")
    rds_engine = _get_db_engine(rec)

    return (
        header("ECS+RDS+SLB标准架构 - 自动生成",
               "Standard ECS+RDS+SLB architecture - auto generated")
        + params_common()
        + params_ecs(ecs_spec)
        + params_rds(rds_spec, rds_engine, 20)
        + resources_vpc()
        + resource_ecs()
        + resource_rds()
        + resource_slb()
        + resource_slb_backend_single()
        + outputs_standard()
    )


def generate_ha(rec):
    """HA: Multi-instance ECS + HighAvailability RDS + Read Replica + SLB."""
    ecs_spec = _get_spec(rec, "ECS", "ecs.c6.large")
    rds_spec = _get_spec(rec, "RDS", "rds.mysql.s2.large")
    rds_engine = _get_db_engine(rec)

    return (
        header("高可用架构(Multi-AZ) - 自动生成",
               "High Availability architecture (multi-AZ) - auto generated")
        + params_common()
        + params_zone2()
        + params_ecs(ecs_spec)
        + params_rds(rds_spec, rds_engine, 50)
        + resources_vpc()
        + resource_vswitch2()
        + resource_ecs_group(count=2, public_ip=False)
        + resource_rds(category="HighAvailability")
        + resource_rds_readonly()
        + resource_slb()
        + resource_slb_backend_group()
        + outputs_ha()
    )


def generate_elastic(rec):
    """Elastic: Seed ECS + ESS + PolarDB + Redis + SLB."""
    ecs_spec = _get_spec(rec, "ECS", "ecs.c6.large")
    polardb_spec = _get_spec(rec, "PolarDB", "polar.mysql.x4.medium")
    redis_spec = _get_spec(rec, "Redis", "redis.master.small.default")

    return (
        header("弹性伸缩架构(ESS+PolarDB+Redis) - 自动生成",
               "Elastic auto-scaling architecture - auto generated")
        + params_common()
        + params_ecs(ecs_spec)
        + params_polardb(polardb_spec)
        + params_redis()
        + resources_vpc()
        + resource_ecs()         # Seed instance for image creation
        + resource_polardb()
        + resource_redis()
        + resource_slb()
        + resource_slb_backend_single()
        + resource_ess()
        + outputs_elastic()
    )


def generate_serverless(rec):
    """Serverless: FC + API Gateway + optional RDS."""
    has_db = rec.get("requirements", {}).get("db", "none") != "none"

    parts = (
        header("Serverless架构(FC+APIGateway) - 自动生成",
               "Serverless architecture (FC + API Gateway) - auto generated")
        + params_common()
        + params_fc()
    )

    if has_db:
        rds_spec = _get_spec(rec, "RDS", "rds.mysql.t1.small")
        rds_engine = _get_db_engine(rec)
        parts += params_rds(rds_spec, rds_engine, 20)

    parts += resources_vpc()
    parts += resource_fc()
    parts += resource_apigateway()

    if has_db:
        parts += resource_rds()

    parts += outputs_serverless()
    return parts


def generate_container(rec):
    """Container: ACK + NAT Gateway + EIP + SNAT + optional RDS."""
    has_db = rec.get("requirements", {}).get("db", "none") != "none"

    parts = (
        header("容器架构(ACK Kubernetes) - 自动生成",
               "Container architecture (Managed ACK) - auto generated")
        + params_common()
        + params_k8s()
    )

    if has_db:
        rds_spec = _get_spec(rec, "RDS", "rds.mysql.s2.large")
        rds_engine = _get_db_engine(rec)
        parts += params_rds(rds_spec, rds_engine, 50)

    parts += resources_vpc()
    parts += resource_nat_eip_snat()
    parts += resource_ack()

    if has_db:
        parts += resource_rds()

    parts += outputs_container()
    return parts


# ===========================================================================
# Main dispatcher
# ===========================================================================

def generate_template(rec):
    """Generate template based on recommendation pattern."""
    pattern = rec.get("pattern", "standard")

    generators = {
        "lite": generate_lite,
        "standard": generate_standard,
        "ha": generate_ha,
        "elastic": generate_elastic,
        "serverless": generate_serverless,
        "container": generate_container,
    }

    generator = generators.get(pattern, generate_standard)
    return generator(rec)


def main():
    parser = argparse.ArgumentParser(description="Generate ROS template from recommendation")
    parser.add_argument("--recommendation", help="Path to recommendation JSON file")
    parser.add_argument("--output", "-o", default="-", help="Output file path (- for stdout)")
    args = parser.parse_args()

    if args.recommendation:
        with open(args.recommendation, "r", encoding="utf-8") as f:
            rec = json.load(f)
    else:
        rec = json.load(sys.stdin)

    template = generate_template(rec)

    if args.output == "-":
        sys.stdout.reconfigure(encoding="utf-8")
        print(template)
    else:
        with open(args.output, "w", encoding="utf-8") as f:
            f.write(template)
        print(f"Template written to {args.output}", file=sys.stderr)


if __name__ == "__main__":
    main()
