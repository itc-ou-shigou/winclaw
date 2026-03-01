#!/usr/bin/env python3
"""
Generate a CloudFormation YAML template from a recommendation JSON.

Usage:
    python generate_cfn_template.py --recommendation recommendation.json --output stack.yaml
    echo '{"pattern":"standard",...}' | python generate_cfn_template.py --output stack.yaml

Reads the recommendation (from analyze_requirements.py) and assembles a deployable
CloudFormation template for all 6 patterns: lite, standard, ha, elastic, serverless, container.
"""

import argparse
import json
import sys
import os


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_spec(rec, service_key, default):
    for item in rec.get("cost_breakdown", []):
        if service_key in item.get("service", ""):
            return item.get("spec", default)
    return default


def _get_db_engine(rec):
    db_req = rec.get("requirements", {}).get("db", "mysql")
    base = db_req.split("+")[0]
    if base == "postgresql":
        return "postgres"
    return "mysql"


def _needs_redis(rec):
    db = rec.get("requirements", {}).get("db", "none")
    pattern = rec.get("pattern", "")
    return "redis" in db or pattern == "elastic"


def _db_port(engine):
    return "5432" if engine == "postgres" else "3306"


# ---------------------------------------------------------------------------
# YAML builder (no PyYAML dependency - simple string assembly)
# ---------------------------------------------------------------------------

def _indent(text, level):
    prefix = "  " * level
    return "\n".join(prefix + line if line.strip() else "" for line in text.split("\n"))


# ---------------------------------------------------------------------------
# VPC / Network resources (reused across patterns)
# ---------------------------------------------------------------------------

def vpc_resources():
    return """
  VPC:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      EnableDnsSupport: true
      EnableDnsHostnames: true
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-vpc"

  InternetGateway:
    Type: AWS::EC2::InternetGateway
    Properties:
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-igw"

  VPCGatewayAttachment:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref VPC
      InternetGatewayId: !Ref InternetGateway

  PublicSubnetA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: !Select [0, !GetAZs ""]
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-public-a"

  PublicSubnetB:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref VPC
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: !Select [1, !GetAZs ""]
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-public-b"

  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref VPC
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-public-rt"

  PublicRoute:
    Type: AWS::EC2::Route
    DependsOn: VPCGatewayAttachment
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway

  SubnetARouteTableAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnetA
      RouteTableId: !Ref PublicRouteTable

  SubnetBRouteTableAssoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnetB
      RouteTableId: !Ref PublicRouteTable
"""


def security_group(extra_ports=None):
    ports_yaml = ""
    if extra_ports:
        for p in extra_ports:
            ports_yaml += f"""
        - IpProtocol: tcp
          FromPort: {p}
          ToPort: {p}
          CidrIp: 0.0.0.0/0"""

    return f"""
  AppSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: !Sub "${{AWS::StackName}} app security group"
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 443
          ToPort: 443
          CidrIp: 0.0.0.0/0
        - IpProtocol: tcp
          FromPort: 22
          ToPort: 22
          CidrIp: 0.0.0.0/0{ports_yaml}
      Tags:
        - Key: Name
          Value: !Sub "${{AWS::StackName}}-sg"
"""


def db_security_group(db_port):
    return f"""
  DBSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: !Sub "${{AWS::StackName}} database security group"
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: {db_port}
          ToPort: {db_port}
          SourceSecurityGroupId: !Ref AppSecurityGroup
      Tags:
        - Key: Name
          Value: !Sub "${{AWS::StackName}}-db-sg"
"""


def db_subnet_group():
    return """
  DBSubnetGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: !Sub "${AWS::StackName} DB subnet group"
      SubnetIds:
        - !Ref PublicSubnetA
        - !Ref PublicSubnetB
"""


def rds_resource(engine, spec, storage, multi_az=False):
    engine_cfn = "mysql" if engine == "mysql" else "postgres"
    engine_ver = "8.0" if engine == "mysql" else "16.3"
    port = _db_port(engine)
    multi_az_str = "true" if multi_az else "false"

    return f"""
  RDSInstance:
    Type: AWS::RDS::DBInstance
    Properties:
      DBInstanceIdentifier: !Sub "${{AWS::StackName}}-db"
      DBInstanceClass: {spec}
      Engine: {engine_cfn}
      EngineVersion: "{engine_ver}"
      MasterUsername: !Ref DBUsername
      MasterUserPassword: !Ref DBPassword
      AllocatedStorage: {storage}
      StorageType: gp3
      MultiAZ: {multi_az_str}
      PubliclyAccessible: false
      VPCSecurityGroups:
        - !Ref DBSecurityGroup
      DBSubnetGroupName: !Ref DBSubnetGroup
      BackupRetentionPeriod: 7
      DeletionProtection: false
      Tags:
        - Key: Name
          Value: !Sub "${{AWS::StackName}}-db"
"""


def redis_resource(spec):
    return f"""
  RedisSubnetGroup:
    Type: AWS::ElastiCache::SubnetGroup
    Properties:
      Description: !Sub "${{AWS::StackName}} Redis subnet group"
      SubnetIds:
        - !Ref PublicSubnetA
        - !Ref PublicSubnetB

  RedisSecurityGroup:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: !Sub "${{AWS::StackName}} Redis security group"
      VpcId: !Ref VPC
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 6379
          ToPort: 6379
          SourceSecurityGroupId: !Ref AppSecurityGroup

  RedisCluster:
    Type: AWS::ElastiCache::CacheCluster
    Properties:
      CacheNodeType: {spec}
      Engine: redis
      NumCacheNodes: 1
      VpcSecurityGroupIds:
        - !Ref RedisSecurityGroup
      CacheSubnetGroupName: !Ref RedisSubnetGroup
      Tags:
        - Key: Name
          Value: !Sub "${{AWS::StackName}}-redis"
"""


# ---------------------------------------------------------------------------
# Pattern: lite
# ---------------------------------------------------------------------------

def build_lite(rec):
    ec2_spec = _get_spec(rec, "EC2", "t3.micro")

    header = f"""AWSTemplateFormatVersion: "2010-09-09"
Description: "Lite pattern - Single EC2 instance (generated by aws-cloud-deploy-skill)"

Parameters:
  KeyPairName:
    Type: AWS::EC2::KeyPair::KeyName
    Description: EC2 Key Pair for SSH access
  InstanceType:
    Type: String
    Default: {ec2_spec}
    AllowedValues: [t3.micro, t3.small, t3.medium, t3.large, m6i.large, m6i.xlarge]
  LatestAmiId:
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64

Resources:"""

    outputs = """
Outputs:
  PublicIP:
    Value: !Ref ElasticIP
    Description: Public IP of the EC2 instance
  SSHCommand:
    Value: !Sub "ssh -i ${KeyPairName}.pem ec2-user@${ElasticIP}"
    Description: SSH command to connect
  InstanceId:
    Value: !Ref EC2Instance
"""

    ec2_resource = """
  EC2Instance:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: !Ref InstanceType
      ImageId: !Ref LatestAmiId
      KeyName: !Ref KeyPairName
      SubnetId: !Ref PublicSubnetA
      SecurityGroupIds:
        - !Ref AppSecurityGroup
      BlockDeviceMappings:
        - DeviceName: /dev/xvda
          Ebs:
            VolumeSize: 30
            VolumeType: gp3
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-ec2"

  ElasticIP:
    Type: AWS::EC2::EIP
    Properties:
      InstanceId: !Ref EC2Instance
"""

    return header + vpc_resources() + security_group() + ec2_resource + outputs


# ---------------------------------------------------------------------------
# Pattern: standard
# ---------------------------------------------------------------------------

def build_standard(rec):
    ec2_spec = _get_spec(rec, "EC2", "t3.small")
    db_engine = _get_db_engine(rec)
    db_spec = _get_spec(rec, "RDS", "db.t3.micro")
    db_storage = 20
    for item in rec.get("cost_breakdown", []):
        if "RDS" in item.get("service", ""):
            detail = item.get("detail", "")
            for part in detail.split():
                if part.endswith("GB"):
                    try:
                        db_storage = int(part[:-2])
                    except ValueError:
                        pass

    header = f"""AWSTemplateFormatVersion: "2010-09-09"
Description: "Standard pattern - EC2 + RDS + ALB (generated by aws-cloud-deploy-skill)"

Parameters:
  KeyPairName:
    Type: AWS::EC2::KeyPair::KeyName
    Description: EC2 Key Pair for SSH access
  InstanceType:
    Type: String
    Default: {ec2_spec}
  DBUsername:
    Type: String
    Default: dbadmin
    NoEcho: true
  DBPassword:
    Type: String
    NoEcho: true
    MinLength: 8
  LatestAmiId:
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64

Resources:"""

    alb = """
  ALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub "${AWS::StackName}-alb"
      Scheme: internet-facing
      Type: application
      Subnets:
        - !Ref PublicSubnetA
        - !Ref PublicSubnetB
      SecurityGroups:
        - !Ref AppSecurityGroup

  ALBTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Port: 80
      Protocol: HTTP
      VpcId: !Ref VPC
      HealthCheckPath: /
      Targets:
        - Id: !Ref EC2Instance
          Port: 80

  ALBListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref ALB
      Port: 80
      Protocol: HTTP
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref ALBTargetGroup
"""

    ec2 = """
  EC2Instance:
    Type: AWS::EC2::Instance
    Properties:
      InstanceType: !Ref InstanceType
      ImageId: !Ref LatestAmiId
      KeyName: !Ref KeyPairName
      SubnetId: !Ref PublicSubnetA
      SecurityGroupIds:
        - !Ref AppSecurityGroup
      BlockDeviceMappings:
        - DeviceName: /dev/xvda
          Ebs:
            VolumeSize: 30
            VolumeType: gp3
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-ec2"
"""

    outputs = f"""
Outputs:
  ALBDNS:
    Value: !GetAtt ALB.DNSName
    Description: ALB DNS name
  AppURL:
    Value: !Sub "http://${{ALB.DNSName}}"
  DBEndpoint:
    Value: !GetAtt RDSInstance.Endpoint.Address
    Description: RDS endpoint
  DBPort:
    Value: !GetAtt RDSInstance.Endpoint.Port
"""

    db_port = _db_port(db_engine)
    return (header + vpc_resources() + security_group() +
            db_security_group(db_port) + db_subnet_group() +
            alb + ec2 + rds_resource(db_engine, db_spec, db_storage) + outputs)


# ---------------------------------------------------------------------------
# Pattern: ha
# ---------------------------------------------------------------------------

def build_ha(rec):
    ec2_spec = _get_spec(rec, "ASG", _get_spec(rec, "EC2", "t3.small"))
    db_engine = _get_db_engine(rec)
    db_spec = _get_spec(rec, "RDS", "db.t3.small")
    db_storage = 50
    has_redis = _needs_redis(rec)
    redis_spec = _get_spec(rec, "ElastiCache", "cache.t3.micro") if has_redis else None

    header = f"""AWSTemplateFormatVersion: "2010-09-09"
Description: "HA pattern - ALB + ASG + Multi-AZ RDS (generated by aws-cloud-deploy-skill)"

Parameters:
  KeyPairName:
    Type: AWS::EC2::KeyPair::KeyName
    Description: EC2 Key Pair for SSH access
  InstanceType:
    Type: String
    Default: {ec2_spec}
  MinSize:
    Type: Number
    Default: 2
  MaxSize:
    Type: Number
    Default: 6
  DBUsername:
    Type: String
    Default: dbadmin
    NoEcho: true
  DBPassword:
    Type: String
    NoEcho: true
    MinLength: 8
  LatestAmiId:
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64

Resources:"""

    alb = """
  ALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub "${AWS::StackName}-alb"
      Scheme: internet-facing
      Type: application
      Subnets:
        - !Ref PublicSubnetA
        - !Ref PublicSubnetB
      SecurityGroups:
        - !Ref AppSecurityGroup

  ALBTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Port: 80
      Protocol: HTTP
      VpcId: !Ref VPC
      HealthCheckPath: /
      HealthCheckIntervalSeconds: 30
      HealthyThresholdCount: 2
      UnhealthyThresholdCount: 5

  ALBListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref ALB
      Port: 80
      Protocol: HTTP
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref ALBTargetGroup
"""

    asg = """
  LaunchTemplate:
    Type: AWS::EC2::LaunchTemplate
    Properties:
      LaunchTemplateData:
        InstanceType: !Ref InstanceType
        ImageId: !Ref LatestAmiId
        KeyName: !Ref KeyPairName
        SecurityGroupIds:
          - !Ref AppSecurityGroup
        BlockDeviceMappings:
          - DeviceName: /dev/xvda
            Ebs:
              VolumeSize: 30
              VolumeType: gp3

  AutoScalingGroup:
    Type: AWS::AutoScaling::AutoScalingGroup
    Properties:
      LaunchTemplate:
        LaunchTemplateId: !Ref LaunchTemplate
        Version: !GetAtt LaunchTemplate.LatestVersionNumber
      MinSize: !Ref MinSize
      MaxSize: !Ref MaxSize
      DesiredCapacity: !Ref MinSize
      VPCZoneIdentifier:
        - !Ref PublicSubnetA
        - !Ref PublicSubnetB
      TargetGroupARNs:
        - !Ref ALBTargetGroup
      HealthCheckType: ELB
      HealthCheckGracePeriod: 300
      Tags:
        - Key: Name
          Value: !Sub "${AWS::StackName}-asg"
          PropagateAtLaunch: true

  ScaleUpPolicy:
    Type: AWS::AutoScaling::ScalingPolicy
    Properties:
      AutoScalingGroupName: !Ref AutoScalingGroup
      PolicyType: TargetTrackingScaling
      TargetTrackingConfiguration:
        PredefinedMetricSpecification:
          PredefinedMetricType: ASGAverageCPUUtilization
        TargetValue: 70.0
"""

    db_port = _db_port(db_engine)
    redis_yaml = redis_resource(redis_spec) if has_redis else ""

    outputs = """
Outputs:
  ALBDNS:
    Value: !GetAtt ALB.DNSName
    Description: ALB DNS name
  AppURL:
    Value: !Sub "http://${ALB.DNSName}"
  DBEndpoint:
    Value: !GetAtt RDSInstance.Endpoint.Address
  DBPort:
    Value: !GetAtt RDSInstance.Endpoint.Port
"""

    return (header + vpc_resources() + security_group() +
            db_security_group(db_port) + db_subnet_group() +
            alb + asg +
            rds_resource(db_engine, db_spec, db_storage, multi_az=True) +
            redis_yaml + outputs)


# ---------------------------------------------------------------------------
# Pattern: elastic
# ---------------------------------------------------------------------------

def build_elastic(rec):
    ec2_spec = _get_spec(rec, "ASG", _get_spec(rec, "EC2", "t3.medium"))
    db_engine = _get_db_engine(rec)
    db_spec = _get_spec(rec, "RDS", "db.t3.medium")
    db_storage = 50
    redis_spec = _get_spec(rec, "ElastiCache", "cache.t3.small")

    header = f"""AWSTemplateFormatVersion: "2010-09-09"
Description: "Elastic pattern - ASG + ElastiCache + CloudFront (generated by aws-cloud-deploy-skill)"

Parameters:
  KeyPairName:
    Type: AWS::EC2::KeyPair::KeyName
    Description: EC2 Key Pair for SSH access
  InstanceType:
    Type: String
    Default: {ec2_spec}
  MinSize:
    Type: Number
    Default: 2
  MaxSize:
    Type: Number
    Default: 10
  DBUsername:
    Type: String
    Default: dbadmin
    NoEcho: true
  DBPassword:
    Type: String
    NoEcho: true
    MinLength: 8
  LatestAmiId:
    Type: AWS::SSM::Parameter::Value<AWS::EC2::Image::Id>
    Default: /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64

Resources:"""

    alb = """
  ALB:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Name: !Sub "${AWS::StackName}-alb"
      Scheme: internet-facing
      Type: application
      Subnets:
        - !Ref PublicSubnetA
        - !Ref PublicSubnetB
      SecurityGroups:
        - !Ref AppSecurityGroup

  ALBTargetGroup:
    Type: AWS::ElasticLoadBalancingV2::TargetGroup
    Properties:
      Port: 80
      Protocol: HTTP
      VpcId: !Ref VPC
      HealthCheckPath: /

  ALBListener:
    Type: AWS::ElasticLoadBalancingV2::Listener
    Properties:
      LoadBalancerArn: !Ref ALB
      Port: 80
      Protocol: HTTP
      DefaultActions:
        - Type: forward
          TargetGroupArn: !Ref ALBTargetGroup
"""

    asg = """
  LaunchTemplate:
    Type: AWS::EC2::LaunchTemplate
    Properties:
      LaunchTemplateData:
        InstanceType: !Ref InstanceType
        ImageId: !Ref LatestAmiId
        KeyName: !Ref KeyPairName
        SecurityGroupIds:
          - !Ref AppSecurityGroup
        BlockDeviceMappings:
          - DeviceName: /dev/xvda
            Ebs:
              VolumeSize: 30
              VolumeType: gp3

  AutoScalingGroup:
    Type: AWS::AutoScaling::AutoScalingGroup
    Properties:
      LaunchTemplate:
        LaunchTemplateId: !Ref LaunchTemplate
        Version: !GetAtt LaunchTemplate.LatestVersionNumber
      MinSize: !Ref MinSize
      MaxSize: !Ref MaxSize
      DesiredCapacity: 3
      VPCZoneIdentifier:
        - !Ref PublicSubnetA
        - !Ref PublicSubnetB
      TargetGroupARNs:
        - !Ref ALBTargetGroup
      HealthCheckType: ELB
      HealthCheckGracePeriod: 300

  ScaleUpPolicy:
    Type: AWS::AutoScaling::ScalingPolicy
    Properties:
      AutoScalingGroupName: !Ref AutoScalingGroup
      PolicyType: TargetTrackingScaling
      TargetTrackingConfiguration:
        PredefinedMetricSpecification:
          PredefinedMetricType: ASGAverageCPUUtilization
        TargetValue: 70.0
"""

    cloudfront = """
  CloudFrontDistribution:
    Type: AWS::CloudFront::Distribution
    Properties:
      DistributionConfig:
        Enabled: true
        Origins:
          - DomainName: !GetAtt ALB.DNSName
            Id: ALBOrigin
            CustomOriginConfig:
              HTTPPort: 80
              OriginProtocolPolicy: http-only
        DefaultCacheBehavior:
          TargetOriginId: ALBOrigin
          ViewerProtocolPolicy: redirect-to-https
          AllowedMethods: [GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE]
          CachedMethods: [GET, HEAD]
          ForwardedValues:
            QueryString: true
            Cookies:
              Forward: all
"""

    db_port = _db_port(db_engine)

    outputs = """
Outputs:
  CloudFrontDomain:
    Value: !GetAtt CloudFrontDistribution.DomainName
    Description: CloudFront distribution domain
  ALBDNS:
    Value: !GetAtt ALB.DNSName
  DBEndpoint:
    Value: !GetAtt RDSInstance.Endpoint.Address
  RedisEndpoint:
    Value: !GetAtt RedisCluster.RedisEndpoint.Address
"""

    return (header + vpc_resources() + security_group() +
            db_security_group(db_port) + db_subnet_group() +
            alb + asg +
            rds_resource(db_engine, db_spec, db_storage) +
            redis_resource(redis_spec) + cloudfront + outputs)


# ---------------------------------------------------------------------------
# Pattern: serverless
# ---------------------------------------------------------------------------

def build_serverless(rec):
    needs_db = rec.get("requirements", {}).get("db", "none") != "none"
    db_engine = _get_db_engine(rec) if needs_db else None
    db_spec = _get_spec(rec, "RDS", "db.t3.micro") if needs_db else None

    header = """AWSTemplateFormatVersion: "2010-09-09"
Description: "Serverless pattern - Lambda + API Gateway (generated by aws-cloud-deploy-skill)"

Parameters:
  FunctionRuntime:
    Type: String
    Default: nodejs20.x
    AllowedValues: [nodejs20.x, python3.12, java21, dotnet8, go1.x]
  FunctionMemory:
    Type: Number
    Default: 256
    AllowedValues: [128, 256, 512, 1024, 2048]"""

    if needs_db:
        header += """
  DBUsername:
    Type: String
    Default: dbadmin
    NoEcho: true
  DBPassword:
    Type: String
    NoEcho: true
    MinLength: 8"""

    header += """

Resources:"""

    lambda_role = """
  LambdaExecutionRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub "${AWS::StackName}-lambda-role"
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              Service: lambda.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
"""

    lambda_fn = """
  LambdaFunction:
    Type: AWS::Lambda::Function
    Properties:
      FunctionName: !Sub "${AWS::StackName}-function"
      Runtime: !Ref FunctionRuntime
      Handler: index.handler
      MemorySize: !Ref FunctionMemory
      Timeout: 30
      Role: !GetAtt LambdaExecutionRole.Arn
      Code:
        ZipFile: |
          exports.handler = async (event) => {
            return {
              statusCode: 200,
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ message: "Hello from Lambda!", timestamp: new Date().toISOString() })
            };
          };
      Environment:
        Variables:
          STAGE: production
"""

    api_gw = """
  ApiGateway:
    Type: AWS::ApiGateway::RestApi
    Properties:
      Name: !Sub "${AWS::StackName}-api"
      Description: API Gateway for Lambda function

  ApiResource:
    Type: AWS::ApiGateway::Resource
    Properties:
      RestApiId: !Ref ApiGateway
      ParentId: !GetAtt ApiGateway.RootResourceId
      PathPart: "{proxy+}"

  ApiMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref ApiGateway
      ResourceId: !Ref ApiResource
      HttpMethod: ANY
      AuthorizationType: NONE
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${LambdaFunction.Arn}/invocations"

  ApiRootMethod:
    Type: AWS::ApiGateway::Method
    Properties:
      RestApiId: !Ref ApiGateway
      ResourceId: !GetAtt ApiGateway.RootResourceId
      HttpMethod: ANY
      AuthorizationType: NONE
      Integration:
        Type: AWS_PROXY
        IntegrationHttpMethod: POST
        Uri: !Sub "arn:aws:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${LambdaFunction.Arn}/invocations"

  ApiDeployment:
    Type: AWS::ApiGateway::Deployment
    DependsOn:
      - ApiMethod
      - ApiRootMethod
    Properties:
      RestApiId: !Ref ApiGateway
      StageName: prod

  LambdaApiPermission:
    Type: AWS::Lambda::Permission
    Properties:
      FunctionName: !Ref LambdaFunction
      Action: lambda:InvokeFunction
      Principal: apigateway.amazonaws.com
      SourceArn: !Sub "arn:aws:execute-api:${AWS::Region}:${AWS::AccountId}:${ApiGateway}/*"

  DeploymentBucket:
    Type: AWS::S3::Bucket
    Properties:
      BucketName: !Sub "${AWS::StackName}-deployments-${AWS::AccountId}"
      BucketEncryption:
        ServerSideEncryptionConfiguration:
          - ServerSideEncryptionByDefault:
              SSEAlgorithm: AES256
"""

    db_yaml = ""
    db_outputs = ""
    if needs_db:
        db_port = _db_port(db_engine)
        db_yaml = (vpc_resources() + security_group() +
                   db_security_group(db_port) + db_subnet_group() +
                   rds_resource(db_engine, db_spec, 20))
        db_outputs = """
  DBEndpoint:
    Value: !GetAtt RDSInstance.Endpoint.Address
  DBPort:
    Value: !GetAtt RDSInstance.Endpoint.Port"""

    outputs = f"""
Outputs:
  ApiURL:
    Value: !Sub "https://${{ApiGateway}}.execute-api.${{AWS::Region}}.amazonaws.com/prod"
    Description: API Gateway URL
  FunctionName:
    Value: !Ref LambdaFunction
  FunctionArn:
    Value: !GetAtt LambdaFunction.Arn{db_outputs}
"""

    return header + lambda_role + lambda_fn + api_gw + db_yaml + outputs


# ---------------------------------------------------------------------------
# Pattern: container
# ---------------------------------------------------------------------------

def build_container(rec):
    node_spec = _get_spec(rec, "Worker", _get_spec(rec, "EC2", "t3.medium"))
    needs_db = rec.get("requirements", {}).get("db", "none") != "none"
    db_engine = _get_db_engine(rec) if needs_db else None
    db_spec = _get_spec(rec, "RDS", "db.t3.small") if needs_db else None

    header = f"""AWSTemplateFormatVersion: "2010-09-09"
Description: "Container pattern - EKS + ECR (generated by aws-cloud-deploy-skill)"

Parameters:
  KubernetesVersion:
    Type: String
    Default: "1.29"
  NodeInstanceType:
    Type: String
    Default: {node_spec}
  NodeGroupMinSize:
    Type: Number
    Default: 2
  NodeGroupMaxSize:
    Type: Number
    Default: 5
  NodeGroupDesiredSize:
    Type: Number
    Default: 3"""

    if needs_db:
        header += """
  DBUsername:
    Type: String
    Default: dbadmin
    NoEcho: true
  DBPassword:
    Type: String
    NoEcho: true
    MinLength: 8"""

    header += """

Resources:"""

    eks_role = """
  EKSClusterRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub "${AWS::StackName}-eks-role"
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              Service: eks.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonEKSClusterPolicy

  NodeGroupRole:
    Type: AWS::IAM::Role
    Properties:
      RoleName: !Sub "${AWS::StackName}-nodegroup-role"
      AssumeRolePolicyDocument:
        Version: "2012-10-17"
        Statement:
          - Effect: Allow
            Principal:
              Service: ec2.amazonaws.com
            Action: sts:AssumeRole
      ManagedPolicyArns:
        - arn:aws:iam::aws:policy/AmazonEKSWorkerNodePolicy
        - arn:aws:iam::aws:policy/AmazonEKS_CNI_Policy
        - arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly
"""

    eks_cluster = """
  EKSCluster:
    Type: AWS::EKS::Cluster
    Properties:
      Name: !Sub "${AWS::StackName}-cluster"
      Version: !Ref KubernetesVersion
      RoleArn: !GetAtt EKSClusterRole.Arn
      ResourcesVpcConfig:
        SubnetIds:
          - !Ref PublicSubnetA
          - !Ref PublicSubnetB
        SecurityGroupIds:
          - !Ref AppSecurityGroup

  NodeGroup:
    Type: AWS::EKS::Nodegroup
    DependsOn: EKSCluster
    Properties:
      ClusterName: !Ref EKSCluster
      NodegroupName: !Sub "${AWS::StackName}-nodegroup"
      NodeRole: !GetAtt NodeGroupRole.Arn
      InstanceTypes:
        - !Ref NodeInstanceType
      ScalingConfig:
        MinSize: !Ref NodeGroupMinSize
        MaxSize: !Ref NodeGroupMaxSize
        DesiredSize: !Ref NodeGroupDesiredSize
      Subnets:
        - !Ref PublicSubnetA
        - !Ref PublicSubnetB
"""

    ecr = """
  ECRRepository:
    Type: AWS::ECR::Repository
    Properties:
      RepositoryName: !Sub "${AWS::StackName}-app"
      ImageScanningConfiguration:
        ScanOnPush: true
"""

    db_yaml = ""
    db_outputs = ""
    if needs_db:
        db_port = _db_port(db_engine)
        db_yaml = (db_security_group(db_port) + db_subnet_group() +
                   rds_resource(db_engine, db_spec, 50))
        db_outputs = """
  DBEndpoint:
    Value: !GetAtt RDSInstance.Endpoint.Address
  DBPort:
    Value: !GetAtt RDSInstance.Endpoint.Port"""

    outputs = f"""
Outputs:
  ClusterName:
    Value: !Ref EKSCluster
    Description: EKS cluster name
  GetCredentials:
    Value: !Sub "aws eks update-kubeconfig --name ${{EKSCluster}} --region ${{AWS::Region}}"
    Description: Command to configure kubectl
  ECRRepositoryUri:
    Value: !Sub "${{AWS::AccountId}}.dkr.ecr.${{AWS::Region}}.amazonaws.com/${{ECRRepository}}"
    Description: ECR repository URI{db_outputs}
"""

    return (header + vpc_resources() + security_group() +
            eks_role + eks_cluster + ecr + db_yaml + outputs)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

BUILDERS = {
    "lite": build_lite,
    "standard": build_standard,
    "ha": build_ha,
    "elastic": build_elastic,
    "serverless": build_serverless,
    "container": build_container,
}


def generate_template(rec):
    pattern = rec.get("pattern", "standard")
    builder = BUILDERS.get(pattern, build_standard)
    return builder(rec)


def main():
    parser = argparse.ArgumentParser(description="Generate CloudFormation template from recommendation")
    parser.add_argument("--recommendation", help="Path to recommendation JSON file")
    parser.add_argument("--output", help="Output YAML file path")
    args = parser.parse_args()

    if args.recommendation:
        with open(args.recommendation, "r", encoding="utf-8") as f:
            rec = json.load(f)
    else:
        rec = json.load(sys.stdin)

    template_yaml = generate_template(rec)

    if args.output:
        os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
        with open(args.output, "w", encoding="utf-8", newline="\n") as f:
            f.write(template_yaml)
        print(f"Written to {args.output} ({len(template_yaml)} bytes)", file=sys.stderr)
    else:
        sys.stdout.reconfigure(encoding="utf-8")
        print(template_yaml)


if __name__ == "__main__":
    main()
