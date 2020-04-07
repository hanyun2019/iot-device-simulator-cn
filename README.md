# AWS IoT 设备仿真平台: 基于AWS国内区域
简体中文 | [English](README.en.md)

AWS提供了许多服务帮助用户快速构建基于无服务器架构的IoT应用，对联网设备的数据进行收集、处理和分析，用户无须管理底层的基础架构，进而帮助用户降低成本并提高生产力，加速业务创新。但如果没有大量联网的设备，IoT应用和后端服务的测试会很难进行。

[AWS IoT Device Simulator](https://aws.amazon.com/solutions/iot-device-simulator/) 是AWS提供的IoT设备仿真平台解决方案，可以帮助用户轻松进行设备集成和IoT后端服务的测试。这个解决方案提供了一个基于Web的控制台，用户可以通过这个控制台创建并进行数百个虚拟联网设备的仿真运行，而不需要实际去配置真实的物理设备，或耗费时间开发相应的脚本。

由于该解决方案使用了一些AWS国内区域暂时未上线的Cognito User Pool服务，在这个项目里我们会探索使用第三方服务或开源软件对这些服务进行替代。比如说，我们会演示如何使用 [Authing.cn](https://authing.cn) 来替换 Cognito User Pool 。注意到这个解决方案并不绑定于某些特定的第三方服务，使用 [Auth0](https://auth0.com) 或开源的 [Keycloak](www.keycloak.org) 等其他认证服务或方案也是可行的。

## 整体架构

<img src="architecture.png" width=800 align=center>

解决方案如下几部分组成：
- Web前端：静态网站部署在S3或是EC2上，提供Web GUI进行仿真作业的管理和结果的展示。
- 仿真平台业务逻辑：仿真平台对外提供API接口，Web前端需要通过Authing认证后获取 Id_Token并发送至API接口进行验证。另外Authing做为 OIDC Identity Provider接入Cognito Identity Pool，Web前端通过Cognito Identity Pool对Id_Token进行验证，并通过STS获取临时AWS密钥，从而实现安全访问AWS IoT服务
- 仿真引擎：通过容器运行在ECS和Fargate上，模拟联网设备进行数据发送


## 部署方法

//待补充

***