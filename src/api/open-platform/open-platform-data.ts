import { http, HttpResponse } from 'msw';
import { categoryLabel } from 'src/lib/open-platform-category';
import {
  REST_SUCCESS_CODE,
  type AccountView,
  type AuthorizationMetadataView,
  type CategoryVersionView,
  type CategoryView,
  type CategoryMergeView,
  type CreateProjectRequest,
  type CreateProjectResult,
  type CursorResult,
  type InvitationView,
  type LoginRequest,
  type LogoutRequest,
  type ModelDiffView,
  type ModelDraftView,
  type ModelVersionView,
  type ProductDetailView,
  type ProductCreateRequest,
  type ProductUpdateRequest,
  type ProductListItem,
  type ProjectKeyPairView,
  type ProjectMemberView,
  type ProjectSummaryView,
  type ProjectView,
  type RefreshRequest,
  type RegisterRequest,
  type RegisterResult,
  type RestResult,
  type TokenResponse,
  type ThingModelDefinition,
  type UpdateProjectRequest,
} from 'src/types/apps/open-platform';

type AccountRecord = AccountView & { password: string };
type ProductRecord = ProductDetailView;
type ModelVersionRecord = ModelVersionView & { definition: ThingModelDefinition };

const now = Date.UTC(2026, 7, 1, 8, 0, 0);

function ok<T>(data: T): RestResult<T> {
  return { code: REST_SUCCESS_CODE, message: 'Success', data };
}

function fail(code: string, message: string, status = 400) {
  return HttpResponse.json(
    { code, message, data: null } satisfies RestResult<null>,
    { status },
  );
}

function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function issueTokens(accountId: string): TokenResponse {
  const accessToken = `access_${accountId}_${Date.now()}`;
  const refreshToken = `refresh_${accountId}_${Date.now()}`;
  refreshTokens.set(refreshToken, accountId);
  sessions.set(accessToken, accountId);
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: 3600,
  };
}

function toAccountView(account: AccountRecord): AccountView {
  return {
    accountId: account.accountId,
    username: account.username,
    email: account.email,
    phone: account.phone,
    status: account.status,
    securityVersion: account.securityVersion,
    createTime: account.createTime,
    updateTime: account.updateTime,
  };
}

function resolveBearerAccountId(request: Request): string | null {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return sessions.get(token) ?? null;
}

function projectViewFor(accountId: string, project: ProjectView): ProjectView {
  const membership = members.find(
    (m) =>
      m.projectId === project.projectId &&
      m.accountId === accountId &&
      m.membershipStatus !== 'REMOVED',
  );
  return {
    ...project,
    myRole: membership?.role ?? project.myRole,
  };
}

const seedAccount: AccountRecord = {
  accountId: 'acc_demo_owner',
  username: 'demo',
  email: 'demo@example.com',
  phone: null,
  status: 'ACTIVE',
  securityVersion: 1,
  createTime: now,
  updateTime: now,
  password: 'Password123!',
};

const seedProjects: ProjectView[] = [
  {
    projectId: 'proj_smart_home',
    projectName: 'Smart Home Hub',
    description: '智能家居设备与产品研发项目',
    status: 'ACTIVE',
    myRole: 'OWNER',
    createTime: now,
    updateTime: now,
  },
  {
    projectId: 'proj_factory_line',
    projectName: 'Factory Line Monitor',
    description: '工厂产线设备监控项目',
    status: 'SUSPENDED',
    myRole: 'ADMIN',
    createTime: now - 86_400_000,
    updateTime: now - 3_600_000,
  },
  {
    projectId: 'proj_legacy_gate',
    projectName: 'Legacy Gate Archive',
    description: '历史门禁项目归档',
    status: 'ARCHIVED',
    myRole: 'VIEWER',
    createTime: now - 172_800_000,
    updateTime: now - 86_400_000,
  },
];

const seedMembers: ProjectMemberView[] = [
  {
    projectId: 'proj_smart_home',
    accountId: 'acc_demo_owner',
    username: 'demo',
    email: 'demo@example.com',
    role: 'OWNER',
    membershipStatus: 'ACTIVE',
    joinedAt: now,
    createTime: now,
    updateTime: now,
  },
  {
    projectId: 'proj_factory_line',
    accountId: 'acc_demo_owner',
    username: 'demo',
    email: 'demo@example.com',
    role: 'ADMIN',
    membershipStatus: 'ACTIVE',
    joinedAt: now - 86_400_000,
    createTime: now - 86_400_000,
    updateTime: now - 86_400_000,
  },
  {
    projectId: 'proj_factory_line',
    accountId: 'acc_other_owner',
    username: 'alice',
    email: 'alice@example.com',
    role: 'OWNER',
    membershipStatus: 'ACTIVE',
    joinedAt: now - 86_400_000,
    createTime: now - 86_400_000,
    updateTime: now - 86_400_000,
  },
  {
    projectId: 'proj_legacy_gate',
    accountId: 'acc_demo_owner',
    username: 'demo',
    email: 'demo@example.com',
    role: 'VIEWER',
    membershipStatus: 'ACTIVE',
    joinedAt: now - 172_800_000,
    createTime: now - 172_800_000,
    updateTime: now - 172_800_000,
  },
];

const seedInvitations: InvitationView[] = [
  {
    invitationId: 'inv_pending_dev',
    projectId: 'proj_smart_home',
    inviteeEmail: 'invitee@example.com',
    inviteeAccountId: null,
    role: 'DEVELOPER',
    status: 'PENDING',
    expiresAt: now + 7 * 86_400_000,
    invitedBy: 'acc_demo_owner',
    acceptedAt: null,
    createTime: now,
  },
];

const seedAuthz: AuthorizationMetadataView[] = [
  {
    projectId: 'proj_smart_home',
    status: 'ACTIVE',
    ipAllowlist: [],
    networkPolicyEnabled: false,
    createTime: now,
    lastRotatedAt: null,
    lastUsedAt: null,
  },
  {
    projectId: 'proj_factory_line',
    status: 'DISABLED',
    ipAllowlist: ['10.0.0.0/8'],
    networkPolicyEnabled: true,
    createTime: now - 86_400_000,
    lastRotatedAt: now - 43_200_000,
    lastUsedAt: now - 3_600_000,
  },
  {
    projectId: 'proj_legacy_gate',
    status: 'REVOKED',
    ipAllowlist: [],
    networkPolicyEnabled: false,
    createTime: now - 172_800_000,
    lastRotatedAt: now - 100_000_000,
    lastUsedAt: now - 90_000_000,
  },
];

const seedKeyPairs: ProjectKeyPairView[] = [
  {
    projectId: 'proj_smart_home',
    clientId: 'cli_smart_home_001',
    clientSecret: 'sec_smart_home_demo_secret',
  },
  {
    projectId: 'proj_factory_line',
    clientId: 'cli_factory_line_001',
    clientSecret: 'sec_factory_line_demo_secret',
  },
  {
    projectId: 'proj_legacy_gate',
    clientId: 'cli_legacy_gate_001',
    clientSecret: 'sec_legacy_gate_demo_secret',
  },
];

type CategorySeedDefinition = Pick<
  CategoryView,
  'categoryCode' | 'parentCode' | 'names' | 'leaf' | 'sort'
>;

function categorySeed(
  categoryCode: string,
  parentCode: string | null,
  chineseName: string,
  englishName: string,
  leaf: boolean,
  sort: number,
): CategorySeedDefinition {
  return {
    categoryCode,
    parentCode,
    names: { 'zh-CN': chineseName, 'en-US': englishName },
    leaf,
    sort,
  };
}

const categorySeedDefinitions: CategorySeedDefinition[] = [
  categorySeed('home', null, '家庭设备', 'Home', false, 1),
  categorySeed('home_lighting', 'home', '照明', 'Lighting', false, 1),
  categorySeed('smart_lamp', 'home_lighting', '智能灯', 'Smart lamp', true, 1),
  categorySeed('smart_switch', 'home_lighting', '智能开关', 'Smart switch', true, 2),
  categorySeed('smart_plug', 'home_lighting', '智能插座', 'Smart plug', true, 3),
  categorySeed('smart_light_strip', 'home_lighting', '灯带控制器', 'Light strip controller', true, 4),
  categorySeed('curtain_motor', 'home_lighting', '窗帘电机', 'Curtain motor', true, 5),
  categorySeed('blind_controller', 'home_lighting', '百叶控制器', 'Blind controller', true, 6),
  categorySeed('home_environment', 'home', '环境监测', 'Environment', false, 2),
  categorySeed('sensor.env', 'home_environment', '环境传感器', 'Environment sensor', true, 1),
  categorySeed('air_quality_sensor', 'home_environment', '空气质量传感器', 'Air quality sensor', true, 2),
  categorySeed('smoke_detector', 'home_environment', '烟雾探测器', 'Smoke detector', true, 3),
  categorySeed('co_detector', 'home_environment', '一氧化碳探测器', 'CO detector', true, 4),
  categorySeed('water_leak_sensor', 'home_environment', '漏水传感器', 'Water leak sensor', true, 5),
  categorySeed('gas_detector', 'home_environment', '燃气探测器', 'Gas detector', true, 6),
  categorySeed('pm25_sensor', 'home_environment', 'PM2.5 传感器', 'PM2.5 sensor', true, 7),
  categorySeed('home_climate', 'home', '暖通控制', 'Climate control', false, 3),
  categorySeed('hvac.thermostat', 'home_climate', '温控器', 'Thermostat', true, 1),
  categorySeed('air_conditioner', 'home_climate', '空调', 'Air conditioner', true, 2),
  categorySeed('air_purifier', 'home_climate', '空气净化器', 'Air purifier', true, 3),
  categorySeed('humidifier', 'home_climate', '加湿器', 'Humidifier', true, 4),
  categorySeed('ventilation_fan', 'home_climate', '新风机', 'Ventilation fan', true, 5),
  categorySeed('floor_heating', 'home_climate', '地暖控制器', 'Floor heating controller', true, 6),
  categorySeed('home_appliance', 'home', '家用电器', 'Home appliance', false, 4),
  categorySeed('smart_tv', 'home_appliance', '智能电视', 'Smart TV', true, 1),
  categorySeed('robot_vacuum', 'home_appliance', '扫地机器人', 'Robot vacuum', true, 2),
  categorySeed('refrigerator', 'home_appliance', '智能冰箱', 'Refrigerator', true, 3),
  categorySeed('washing_machine', 'home_appliance', '洗衣机', 'Washing machine', true, 4),
  categorySeed('water_heater', 'home_appliance', '热水器', 'Water heater', true, 5),
  categorySeed('coffee_machine', 'home_appliance', '咖啡机', 'Coffee machine', true, 6),
  categorySeed('home_access', 'home', '家居通行', 'Home access', false, 5),
  categorySeed('smart_door', 'home_access', '智能门', 'Smart door', true, 1),
  categorySeed('video_intercom', 'home_access', '可视对讲', 'Video intercom', true, 2),
  categorySeed('garage_door', 'home_access', '车库门控制器', 'Garage door controller', true, 3),
  categorySeed('home_energy', 'home', '家庭能源', 'Home energy', false, 6),
  categorySeed('smart_meter', 'home_energy', '智能电表', 'Smart meter', true, 1),
  categorySeed('energy_gateway', 'home_energy', '能源网关', 'Energy gateway', true, 2),
  categorySeed('home_battery', 'home_energy', '家庭储能', 'Home battery', true, 3),

  categorySeed('industrial', null, '工业设备', 'Industrial', false, 2),
  categorySeed('gateway.edge', 'industrial', '边缘网关', 'Edge gateway', true, 1),
  categorySeed('industrial_control', 'industrial', '工业控制', 'Industrial control', false, 2),
  categorySeed('plc', 'industrial_control', '可编程控制器', 'PLC', true, 1),
  categorySeed('industrial_robot', 'industrial_control', '工业机器人', 'Industrial robot', true, 2),
  categorySeed('vfd', 'industrial_control', '变频器', 'Variable frequency drive', true, 3),
  categorySeed('servo_drive', 'industrial_control', '伺服驱动器', 'Servo drive', true, 4),
  categorySeed('industrial_controller', 'industrial_control', '工业控制器', 'Industrial controller', true, 5),
  categorySeed('industrial_safety', 'industrial', '工业安全', 'Industrial safety', false, 3),
  categorySeed('safety_light_curtain', 'industrial_safety', '安全光幕', 'Safety light curtain', true, 1),
  categorySeed('vibration_sensor', 'industrial_safety', '振动传感器', 'Vibration sensor', true, 2),
  categorySeed('machine_vision', 'industrial_safety', '机器视觉', 'Machine vision', true, 3),
  categorySeed('emergency_stop', 'industrial_safety', '急停按钮', 'Emergency stop', true, 4),
  categorySeed('industrial_energy', 'industrial', '工业能源', 'Industrial energy', false, 4),
  categorySeed('industrial_power_meter', 'industrial_energy', '工业电能表', 'Industrial power meter', true, 1),
  categorySeed('air_compressor', 'industrial_energy', '空气压缩机', 'Air compressor', true, 2),
  categorySeed('steam_meter', 'industrial_energy', '蒸汽流量计', 'Steam meter', true, 3),
  categorySeed('industrial_logistics', 'industrial', '工业物流', 'Industrial logistics', false, 5),
  categorySeed('agv', 'industrial_logistics', '无人搬运车', 'AGV', true, 1),
  categorySeed('conveyor_controller', 'industrial_logistics', '输送线控制器', 'Conveyor controller', true, 2),
  categorySeed('pallet_tracker', 'industrial_logistics', '托盘追踪器', 'Pallet tracker', true, 3),

  categorySeed('security', null, '安防设备', 'Security', false, 3),
  categorySeed('security.lock', 'security', '智能门锁', 'Smart lock', true, 1),
  categorySeed('security_access', 'security', '门禁管理', 'Access control', false, 2),
  categorySeed('access_controller', 'security_access', '门禁控制器', 'Access controller', true, 1),
  categorySeed('card_reader', 'security_access', '读卡器', 'Card reader', true, 2),
  categorySeed('turnstile', 'security_access', '闸机', 'Turnstile', true, 3),
  categorySeed('key_box', 'security_access', '钥匙柜', 'Key box', true, 4),
  categorySeed('security_video', 'security', '视频监控', 'Video surveillance', false, 3),
  categorySeed('security_camera', 'security_video', '安防摄像机', 'Security camera', true, 1),
  categorySeed('ptz_camera', 'security_video', '云台摄像机', 'PTZ camera', true, 2),
  categorySeed('nvr', 'security_video', '网络录像机', 'NVR', true, 3),
  categorySeed('video_doorbell', 'security_video', '可视门铃', 'Video doorbell', true, 4),
  categorySeed('camera_bridge', 'security_video', '摄像机网桥', 'Camera bridge', true, 5),
  categorySeed('security_alarm', 'security', '报警设备', 'Alarm devices', false, 4),
  categorySeed('motion_detector', 'security_alarm', '人体探测器', 'Motion detector', true, 1),
  categorySeed('panic_button', 'security_alarm', '紧急按钮', 'Panic button', true, 2),
  categorySeed('perimeter_detector', 'security_alarm', '周界探测器', 'Perimeter detector', true, 3),
  categorySeed('glass_break_detector', 'security_alarm', '玻璃破碎探测器', 'Glass break detector', true, 4),
  categorySeed('security_siren', 'security_alarm', '声光警号', 'Security siren', true, 5),
  categorySeed('security_fire', 'security', '消防安全', 'Fire safety', false, 5),
  categorySeed('fire_panel', 'security_fire', '消防主机', 'Fire panel', true, 1),
  categorySeed('fire_water_sensor', 'security_fire', '消防水压传感器', 'Fire water sensor', true, 2),
  categorySeed('fire_door_controller', 'security_fire', '防火门控制器', 'Fire door controller', true, 3),
  categorySeed('security_personnel', 'security', '人员识别', 'Personnel identification', false, 6),
  categorySeed('visitor_terminal', 'security_personnel', '访客终端', 'Visitor terminal', true, 1),
  categorySeed('personnel_tag', 'security_personnel', '人员标签', 'Personnel tag', true, 2),

  categorySeed('environment', null, '环境与气象', 'Environment & weather', false, 4),
  categorySeed('environment_weather', 'environment', '气象监测', 'Weather monitoring', false, 1),
  categorySeed('weather_station', 'environment_weather', '气象站', 'Weather station', true, 1),
  categorySeed('wind_sensor', 'environment_weather', '风速风向传感器', 'Wind sensor', true, 2),
  categorySeed('rain_gauge', 'environment_weather', '雨量计', 'Rain gauge', true, 3),
  categorySeed('barometer', 'environment_weather', '气压传感器', 'Barometer', true, 4),
  categorySeed('environment_water', 'environment', '水质与水务', 'Water monitoring', false, 2),
  categorySeed('water_quality_sensor', 'environment_water', '水质传感器', 'Water quality sensor', true, 1),
  categorySeed('ph_sensor', 'environment_water', 'pH 传感器', 'pH sensor', true, 2),
  categorySeed('water_level_sensor', 'environment_water', '水位传感器', 'Water level sensor', true, 3),
  categorySeed('flow_meter', 'environment_water', '流量计', 'Flow meter', true, 4),
  categorySeed('environment_air', 'environment', '空气与噪声', 'Air & noise', false, 3),
  categorySeed('noise_sensor', 'environment_air', '噪声传感器', 'Noise sensor', true, 1),
  categorySeed('dust_sensor', 'environment_air', '粉尘传感器', 'Dust sensor', true, 2),
  categorySeed('co2_station', 'environment_air', '二氧化碳监测站', 'CO2 station', true, 3),
  categorySeed('environment_soil', 'environment', '土壤与辐射', 'Soil & radiation', false, 4),
  categorySeed('soil_sensor', 'environment_soil', '土壤传感器', 'Soil sensor', true, 1),
  categorySeed('radiation_sensor', 'environment_soil', '辐射传感器', 'Radiation sensor', true, 2),
  categorySeed('uv_sensor', 'environment_soil', '紫外线传感器', 'UV sensor', true, 3),

  categorySeed('energy', null, '能源与电力', 'Energy & power', false, 5),
  categorySeed('energy_solar', 'energy', '光伏发电', 'Solar power', false, 1),
  categorySeed('pv_inverter', 'energy_solar', '光伏逆变器', 'PV inverter', true, 1),
  categorySeed('pv_panel', 'energy_solar', '光伏组件', 'PV panel', true, 2),
  categorySeed('solar_tracker', 'energy_solar', '光伏跟踪器', 'Solar tracker', true, 3),
  categorySeed('combiner_box', 'energy_solar', '汇流箱', 'Combiner box', true, 4),
  categorySeed('energy_storage', 'energy', '储能系统', 'Energy storage', false, 2),
  categorySeed('battery_storage', 'energy_storage', '储能电池', 'Battery storage', true, 1),
  categorySeed('bms', 'energy_storage', '电池管理系统', 'Battery management system', true, 2),
  categorySeed('energy_storage_controller', 'energy_storage', '储能控制器', 'Energy storage controller', true, 3),
  categorySeed('energy_charging', 'energy', '充换电设施', 'EV charging', false, 3),
  categorySeed('ev_charger', 'energy_charging', '交流充电桩', 'AC EV charger', true, 1),
  categorySeed('dc_charger', 'energy_charging', '直流充电桩', 'DC EV charger', true, 2),
  categorySeed('battery_swap', 'energy_charging', '换电柜', 'Battery swap cabinet', true, 3),
  categorySeed('energy_grid', 'energy', '输配电设备', 'Power grid', false, 4),
  categorySeed('transformer', 'energy_grid', '变压器', 'Transformer', true, 1),
  categorySeed('switchgear', 'energy_grid', '开关柜', 'Switchgear', true, 2),
  categorySeed('power_quality_meter', 'energy_grid', '电能质量表', 'Power quality meter', true, 3),
  categorySeed('energy_gas', 'energy', '燃气能源', 'Gas energy', false, 5),
  categorySeed('gas_meter', 'energy_gas', '燃气表', 'Gas meter', true, 1),
  categorySeed('gas_pressure_sensor', 'energy_gas', '燃气压力传感器', 'Gas pressure sensor', true, 2),

  categorySeed('agriculture', null, '农业设备', 'Agriculture', false, 6),
  categorySeed('agri_irrigation', 'agriculture', '灌溉设备', 'Irrigation', false, 1),
  categorySeed('irrigation_controller', 'agri_irrigation', '灌溉控制器', 'Irrigation controller', true, 1),
  categorySeed('water_pump', 'agri_irrigation', '水泵', 'Water pump', true, 2),
  categorySeed('soil_moisture_sensor', 'agri_irrigation', '土壤墒情传感器', 'Soil moisture sensor', true, 3),
  categorySeed('valve_controller', 'agri_irrigation', '阀门控制器', 'Valve controller', true, 4),
  categorySeed('agri_greenhouse', 'agriculture', '温室设施', 'Greenhouse', false, 2),
  categorySeed('greenhouse_controller', 'agri_greenhouse', '温室控制器', 'Greenhouse controller', true, 1),
  categorySeed('grow_light', 'agri_greenhouse', '植物生长灯', 'Grow light', true, 2),
  categorySeed('fertigation_controller', 'agri_greenhouse', '水肥一体机', 'Fertigation controller', true, 3),
  categorySeed('greenhouse_fan', 'agri_greenhouse', '温室风机', 'Greenhouse fan', true, 4),
  categorySeed('agri_livestock', 'agriculture', '畜牧养殖', 'Livestock', false, 3),
  categorySeed('livestock_tracker', 'agri_livestock', '牲畜定位器', 'Livestock tracker', true, 1),
  categorySeed('feed_controller', 'agri_livestock', '饲喂控制器', 'Feed controller', true, 2),
  categorySeed('barn_environment_sensor', 'agri_livestock', '畜舍环境传感器', 'Barn environment sensor', true, 3),
  categorySeed('agri_field', 'agriculture', '农田监测', 'Field monitoring', false, 4),
  categorySeed('agri_weather_station', 'agri_field', '农业气象站', 'Agricultural weather station', true, 1),
  categorySeed('pest_trap', 'agri_field', '虫情测报灯', 'Pest trap', true, 2),
  categorySeed('crop_monitor', 'agri_field', '作物监测器', 'Crop monitor', true, 3),

  categorySeed('transportation', null, '交通设备', 'Transportation', false, 7),
  categorySeed('transport_parking', 'transportation', '停车管理', 'Parking', false, 1),
  categorySeed('parking_gate', 'transport_parking', '停车道闸', 'Parking gate', true, 1),
  categorySeed('parking_sensor', 'transport_parking', '车位传感器', 'Parking sensor', true, 2),
  categorySeed('parking_meter', 'transport_parking', '停车计费终端', 'Parking meter', true, 3),
  categorySeed('parking_camera', 'transport_parking', '停车摄像机', 'Parking camera', true, 4),
  categorySeed('transport_tracking', 'transportation', '资产定位', 'Asset tracking', false, 2),
  categorySeed('uwb_tag', 'transport_tracking', 'UWB 标签', 'UWB tag', true, 1),
  categorySeed('gps_tracker', 'transport_tracking', 'GPS 定位器', 'GPS tracker', true, 2),
  categorySeed('rfid_reader', 'transport_tracking', 'RFID 读写器', 'RFID reader', true, 3),
  categorySeed('asset_tracker', 'transport_tracking', '资产追踪器', 'Asset tracker', true, 4),
  categorySeed('transport_fleet', 'transportation', '车队设备', 'Fleet devices', false, 3),
  categorySeed('vehicle_terminal', 'transport_fleet', '车载终端', 'Vehicle terminal', true, 1),
  categorySeed('dash_camera', 'transport_fleet', '行车记录仪', 'Dash camera', true, 2),
  categorySeed('tachograph', 'transport_fleet', '行驶记录仪', 'Tachograph', true, 3),
  categorySeed('transport_rail', 'transportation', '轨道交通', 'Rail transit', false, 4),
  categorySeed('rail_detector', 'transport_rail', '轨道检测器', 'Rail detector', true, 1),
  categorySeed('axle_counter', 'transport_rail', '计轴器', 'Axle counter', true, 2),
  categorySeed('transport_marine', 'transportation', '船舶与水运', 'Marine transport', false, 5),
  categorySeed('vessel_tracker', 'transport_marine', '船舶定位器', 'Vessel tracker', true, 1),
  categorySeed('buoy_monitor', 'transport_marine', '浮标监测器', 'Buoy monitor', true, 2),

  categorySeed('building', null, '楼宇设施', 'Building', false, 8),
  categorySeed('building_hvac', 'building', '楼宇暖通', 'Building HVAC', false, 1),
  categorySeed('building_hvac_controller', 'building_hvac', '楼宇暖通控制器', 'Building HVAC controller', true, 1),
  categorySeed('chiller', 'building_hvac', '冷水机组', 'Chiller', true, 2),
  categorySeed('vav_controller', 'building_hvac', '变风量控制器', 'VAV controller', true, 3),
  categorySeed('building_lighting', 'building', '楼宇照明', 'Building lighting', false, 2),
  categorySeed('building_lighting_controller', 'building_lighting', '照明控制器', 'Lighting controller', true, 1),
  categorySeed('lighting_gateway', 'building_lighting', '照明网关', 'Lighting gateway', true, 2),
  categorySeed('occupancy_sensor', 'building_lighting', '占用传感器', 'Occupancy sensor', true, 3),
  categorySeed('building_elevator', 'building', '电梯设备', 'Elevator', false, 3),
  categorySeed('elevator_controller', 'building_elevator', '电梯控制器', 'Elevator controller', true, 1),
  categorySeed('elevator_sensor', 'building_elevator', '电梯传感器', 'Elevator sensor', true, 2),
  categorySeed('building_fire', 'building', '楼宇消防', 'Building fire safety', false, 4),
  categorySeed('building_fire_panel', 'building_fire', '楼宇消防主机', 'Building fire panel', true, 1),
  categorySeed('fire_sprinkler_monitor', 'building_fire', '喷淋监测器', 'Fire sprinkler monitor', true, 2),
  categorySeed('building_fire_door_controller', 'building_fire', '楼宇防火门控制器', 'Building fire door controller', true, 3),
  categorySeed('building_water', 'building', '楼宇给排水', 'Building water', false, 5),
  categorySeed('water_pump_controller', 'building_water', '水泵控制器', 'Water pump controller', true, 1),
  categorySeed('water_tank_sensor', 'building_water', '水箱液位传感器', 'Water tank sensor', true, 2),
  categorySeed('drainage_sensor', 'building_water', '排水监测器', 'Drainage sensor', true, 3),

  categorySeed('network', null, '网络通信', 'Network & connectivity', false, 9),
  categorySeed('network_gateway', 'network', '网关设备', 'Gateway devices', false, 1),
  categorySeed('iot_gateway', 'network_gateway', '物联网关', 'IoT gateway', true, 1),
  categorySeed('lorawan_gateway', 'network_gateway', 'LoRaWAN 网关', 'LoRaWAN gateway', true, 2),
  categorySeed('ble_gateway', 'network_gateway', '蓝牙网关', 'BLE gateway', true, 3),
  categorySeed('industrial_router', 'network_gateway', '工业路由器', 'Industrial router', true, 4),
  categorySeed('network_module', 'network', '通信模组', 'Communication modules', false, 2),
  categorySeed('cellular_module', 'network_module', '蜂窝通信模组', 'Cellular module', true, 1),
  categorySeed('wifi_module', 'network_module', 'Wi-Fi 模组', 'Wi-Fi module', true, 2),
  categorySeed('gnss_module', 'network_module', 'GNSS 模组', 'GNSS module', true, 3),
  categorySeed('network_device', 'network', '边缘网络设备', 'Edge network devices', false, 3),
  categorySeed('edge_compute', 'network_device', '边缘计算节点', 'Edge compute', true, 1),
  categorySeed('protocol_gateway', 'network_device', '协议转换网关', 'Protocol gateway', true, 2),
  categorySeed('network_probe', 'network_device', '网络探针', 'Network probe', true, 3),

  categorySeed('healthcare', null, '医疗健康', 'Healthcare', false, 10),
  categorySeed('healthcare_monitor', 'healthcare', '健康监测', 'Health monitoring', false, 1),
  categorySeed('patient_monitor', 'healthcare_monitor', '患者监护仪', 'Patient monitor', true, 1),
  categorySeed('vital_sensor', 'healthcare_monitor', '生命体征传感器', 'Vital sensor', true, 2),
  categorySeed('pulse_oximeter', 'healthcare_monitor', '血氧仪', 'Pulse oximeter', true, 3),
  categorySeed('temperature_monitor', 'healthcare_monitor', '体温监测器', 'Temperature monitor', true, 4),
  categorySeed('healthcare_asset', 'healthcare', '医疗资产', 'Medical assets', false, 2),
  categorySeed('medical_gateway', 'healthcare_asset', '医疗网关', 'Medical gateway', true, 1),
  categorySeed('infusion_pump', 'healthcare_asset', '输液泵', 'Infusion pump', true, 2),
  categorySeed('medical_refrigerator', 'healthcare_asset', '医用冷藏柜', 'Medical refrigerator', true, 3),
  categorySeed('healthcare_emergency', 'healthcare', '医疗呼叫', 'Medical emergency', false, 3),
  categorySeed('nurse_call', 'healthcare_emergency', '病房呼叫器', 'Nurse call', true, 1),
  categorySeed('medical_emergency_button', 'healthcare_emergency', '医疗紧急按钮', 'Medical emergency button', true, 2),

  categorySeed('retail', null, '商业零售', 'Retail', false, 11),
  categorySeed('retail_shelf', 'retail', '零售货架', 'Retail shelving', false, 1),
  categorySeed('smart_shelf', 'retail_shelf', '智能货架', 'Smart shelf', true, 1),
  categorySeed('electronic_shelf_label', 'retail_shelf', '电子价签', 'Electronic shelf label', true, 2),
  categorySeed('inventory_sensor', 'retail_shelf', '库存传感器', 'Inventory sensor', true, 3),
  categorySeed('retail_pos', 'retail', '收银设备', 'POS devices', false, 2),
  categorySeed('pos_terminal', 'retail_pos', '收银终端', 'POS terminal', true, 1),
  categorySeed('self_checkout', 'retail_pos', '自助结算机', 'Self-checkout', true, 2),
  categorySeed('retail_cold_chain', 'retail', '冷链零售', 'Retail cold chain', false, 3),
  categorySeed('cold_chain_logger', 'retail_cold_chain', '冷链记录仪', 'Cold-chain logger', true, 1),
  categorySeed('freezer_monitor', 'retail_cold_chain', '冷柜监测器', 'Freezer monitor', true, 2),
  categorySeed('retail_security', 'retail', '零售安防', 'Retail security', false, 4),
  categorySeed('retail_theft_detector', 'retail_security', '防盗探测器', 'Retail theft detector', true, 1),
];

function buildCategoryTree(definitions: CategorySeedDefinition[]): CategoryView[] {
  const definitionsByCode = new Map(
    definitions.map((definition) => [definition.categoryCode, definition]),
  );

  return definitions.map((definition) => {
    const parentPath: CategoryView['parentPath'] = [];
    let parentCode = definition.parentCode;

    while (parentCode) {
      const parent = definitionsByCode.get(parentCode);
      if (!parent) break;
      parentPath.unshift({
        categoryCode: parent.categoryCode,
        names: parent.names,
      });
      parentCode = parent.parentCode;
    }

    return {
      ...definition,
      level: parentPath.length + 1,
      status: 'ACTIVE',
      parentPath,
    };
  });
}

const seedCategories = buildCategoryTree(categorySeedDefinitions);

const lampTemplate: CategoryVersionView['template'] = {
  properties: [
    { code: 'power', title: '开关', access: 'READ_WRITE', schema: { type: 'boolean' }, required: true },
    {
      code: 'brightness',
      title: '亮度',
      access: 'READ_WRITE',
      schema: { type: 'integer', minimum: 0, maximum: 100 },
      required: false,
    },
    {
      code: 'colorTemperature',
      title: '色温',
      access: 'READ_WRITE',
      schema: { type: 'integer', minimum: 2700, maximum: 6500 },
      required: false,
    },
  ],
  actions: [
    {
      code: 'toggle',
      title: '切换开关',
      inputSchema: { type: 'object', additionalProperties: false },
      outputSchema: { type: 'object', properties: { accepted: { type: 'boolean' } } },
      invokeMode: 'SYNC',
    },
    {
      code: 'setScene',
      title: '设置场景',
      inputSchema: { type: 'object', properties: { sceneId: { type: 'string' } }, required: ['sceneId'] },
      outputSchema: true,
      invokeMode: 'ASYNC',
    },
  ],
  events: [
    {
      code: 'fault',
      title: '故障告警',
      outputSchema: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } },
      eventType: 'FAULT',
    },
  ],
};

const environmentTemplate: CategoryVersionView['template'] = {
  properties: [
    { code: 'temperature', title: '温度', access: 'READ_ONLY', schema: { type: 'number', unit: '℃' }, required: true },
    { code: 'humidity', title: '湿度', access: 'READ_ONLY', schema: { type: 'number', minimum: 0, maximum: 100, unit: '%' }, required: true },
    { code: 'batteryLevel', title: '电量', access: 'READ_ONLY', schema: { type: 'integer', minimum: 0, maximum: 100, unit: '%' }, required: false },
  ],
  actions: [
    { code: 'calibrate', title: '校准传感器', inputSchema: true, outputSchema: true, invokeMode: 'ASYNC' },
  ],
  events: [
    { code: 'lowBattery', title: '低电量', outputSchema: { type: 'object', properties: { level: { type: 'integer' } } }, eventType: 'WARN' },
  ],
};

const thermostatTemplate: CategoryVersionView['template'] = {
  properties: [
    { code: 'power', title: '开关', access: 'READ_WRITE', schema: { type: 'boolean' }, required: true },
    { code: 'targetTemperature', title: '目标温度', access: 'READ_WRITE', schema: { type: 'number', minimum: 16, maximum: 30, unit: '℃' }, required: true },
    { code: 'currentTemperature', title: '当前温度', access: 'READ_ONLY', schema: { type: 'number', unit: '℃' }, required: true },
  ],
  actions: [
    { code: 'setMode', title: '设置模式', inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['HEAT', 'COOL', 'AUTO'] } }, required: ['mode'] }, outputSchema: true, invokeMode: 'SYNC' },
    { code: 'setTargetTemperature', title: '设置目标温度', inputSchema: { type: 'object', properties: { value: { type: 'number' } }, required: ['value'] }, outputSchema: true, invokeMode: 'SYNC' },
  ],
  events: [
    { code: 'fault', title: '设备故障', outputSchema: { type: 'object', properties: { code: { type: 'string' } } }, eventType: 'FAULT' },
  ],
};

const gatewayTemplate: CategoryVersionView['template'] = {
  properties: [
    { code: 'online', title: '在线状态', access: 'READ_ONLY', schema: { type: 'boolean' }, required: true },
    { code: 'connectedDevices', title: '已连接设备数', access: 'READ_ONLY', schema: { type: 'integer', minimum: 0 }, required: true },
  ],
  actions: [
    { code: 'restart', title: '重启网关', inputSchema: { type: 'object', additionalProperties: false }, outputSchema: true, invokeMode: 'ASYNC' },
  ],
  events: [
    { code: 'offline', title: '网关离线', outputSchema: { type: 'object', properties: { reason: { type: 'string' } } }, eventType: 'WARN' },
  ],
};

const lockTemplate: CategoryVersionView['template'] = {
  properties: [
    { code: 'locked', title: '锁定状态', access: 'READ_ONLY', schema: { type: 'boolean' }, required: true },
    { code: 'batteryLevel', title: '电量', access: 'READ_ONLY', schema: { type: 'integer', minimum: 0, maximum: 100, unit: '%' }, required: true },
    { code: 'tamper', title: '防拆状态', access: 'READ_ONLY', schema: { type: 'boolean' }, required: false },
  ],
  actions: [
    { code: 'unlock', title: '解锁', inputSchema: { type: 'object', properties: { credentialId: { type: 'string' } }, required: ['credentialId'] }, outputSchema: true, invokeMode: 'SYNC' },
    { code: 'lock', title: '上锁', inputSchema: { type: 'object', additionalProperties: false }, outputSchema: true, invokeMode: 'SYNC' },
  ],
  events: [
    { code: 'forcedOpen', title: '强行开锁', outputSchema: { type: 'object', properties: { at: { type: 'string', format: 'date-time' } } }, eventType: 'FAULT' },
  ],
};

const sensorTemplate: CategoryVersionView['template'] = {
  properties: [
    { code: 'online', title: '在线状态', access: 'READ_ONLY', schema: { type: 'boolean' }, required: true },
    { code: 'measurement', title: '测量值', access: 'READ_ONLY', schema: { type: 'number' }, required: true },
    { code: 'batteryLevel', title: '电量', access: 'READ_ONLY', schema: { type: 'integer', minimum: 0, maximum: 100, unit: '%' }, required: false },
    { code: 'signalStrength', title: '信号强度', access: 'READ_ONLY', schema: { type: 'integer', minimum: -120, maximum: 0, unit: 'dBm' }, required: false },
  ],
  actions: [
    { code: 'calibrate', title: '校准设备', inputSchema: true, outputSchema: true, invokeMode: 'ASYNC' },
  ],
  events: [
    { code: 'thresholdExceeded', title: '阈值超限', outputSchema: { type: 'object', properties: { value: { type: 'number' }, threshold: { type: 'number' } } }, eventType: 'WARN' },
    { code: 'offline', title: '设备离线', outputSchema: { type: 'object', properties: { reason: { type: 'string' } } }, eventType: 'WARN' },
  ],
};

const cameraTemplate: CategoryVersionView['template'] = {
  properties: [
    { code: 'online', title: '在线状态', access: 'READ_ONLY', schema: { type: 'boolean' }, required: true },
    { code: 'streamStatus', title: '视频流状态', access: 'READ_ONLY', schema: { type: 'string', enum: ['IDLE', 'STREAMING', 'ERROR'] }, required: true },
    { code: 'storageStatus', title: '存储状态', access: 'READ_ONLY', schema: { type: 'string', enum: ['NORMAL', 'FULL', 'ERROR'] }, required: false },
  ],
  actions: [
    { code: 'reboot', title: '重启设备', inputSchema: true, outputSchema: true, invokeMode: 'ASYNC' },
    { code: 'capture', title: '抓拍', inputSchema: true, outputSchema: { type: 'object', properties: { imageUrl: { type: 'string' } } }, invokeMode: 'SYNC' },
  ],
  events: [
    { code: 'motionDetected', title: '检测到移动', outputSchema: { type: 'object', properties: { confidence: { type: 'number' } } }, eventType: 'INFO' },
  ],
};

const meterTemplate: CategoryVersionView['template'] = {
  properties: [
    { code: 'totalEnergy', title: '累计用能', access: 'READ_ONLY', schema: { type: 'number', minimum: 0, unit: 'kWh' }, required: true },
    { code: 'voltage', title: '电压', access: 'READ_ONLY', schema: { type: 'number', minimum: 0, unit: 'V' }, required: false },
    { code: 'current', title: '电流', access: 'READ_ONLY', schema: { type: 'number', minimum: 0, unit: 'A' }, required: false },
  ],
  actions: [
    { code: 'reset', title: '清零', inputSchema: { type: 'object', additionalProperties: false }, outputSchema: true, invokeMode: 'SYNC' },
  ],
  events: [
    { code: 'thresholdExceeded', title: '能耗超限', outputSchema: { type: 'object', properties: { value: { type: 'number' }, threshold: { type: 'number' } } }, eventType: 'WARN' },
  ],
};

const trackingTemplate: CategoryVersionView['template'] = {
  properties: [
    { code: 'latitude', title: '纬度', access: 'READ_ONLY', schema: { type: 'number', minimum: -90, maximum: 90 }, required: true },
    { code: 'longitude', title: '经度', access: 'READ_ONLY', schema: { type: 'number', minimum: -180, maximum: 180 }, required: true },
    { code: 'batteryLevel', title: '电量', access: 'READ_ONLY', schema: { type: 'integer', minimum: 0, maximum: 100, unit: '%' }, required: false },
    { code: 'lastSeen', title: '最后定位时间', access: 'READ_ONLY', schema: { type: 'string', format: 'date-time' }, required: true },
  ],
  actions: [
    { code: 'locate', title: '立即定位', inputSchema: true, outputSchema: { type: 'object', properties: { accepted: { type: 'boolean' } } }, invokeMode: 'ASYNC' },
  ],
  events: [
    { code: 'geofence', title: '电子围栏告警', outputSchema: { type: 'object', properties: { fenceId: { type: 'string' }, action: { type: 'string' } } }, eventType: 'WARN' },
  ],
};

const controllerTemplate: CategoryVersionView['template'] = {
  properties: [
    { code: 'online', title: '在线状态', access: 'READ_ONLY', schema: { type: 'boolean' }, required: true },
    { code: 'operatingMode', title: '运行模式', access: 'READ_WRITE', schema: { type: 'string', enum: ['AUTO', 'MANUAL', 'MAINTENANCE'] }, required: true },
    { code: 'alarm', title: '告警状态', access: 'READ_ONLY', schema: { type: 'boolean' }, required: false },
  ],
  actions: [
    { code: 'restart', title: '重启设备', inputSchema: true, outputSchema: true, invokeMode: 'ASYNC' },
    { code: 'setMode', title: '设置运行模式', inputSchema: { type: 'object', properties: { mode: { type: 'string', enum: ['AUTO', 'MANUAL', 'MAINTENANCE'] } }, required: ['mode'] }, outputSchema: true, invokeMode: 'SYNC' },
  ],
  events: [
    { code: 'fault', title: '设备故障', outputSchema: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' } } }, eventType: 'FAULT' },
  ],
};

function defaultTemplateForCategory(categoryCode: string): CategoryVersionView['template'] {
  const code = categoryCode.toLowerCase();

  if (/(camera|nvr|doorbell)/.test(code)) return cameraTemplate;
  if (/(gateway|router|module|protocol|edge_compute|network_probe)/.test(code)) return gatewayTemplate;
  if (/(meter|inverter|panel|bms|battery|charger|transformer|switchgear|power_quality|compressor|flow|pressure)/.test(code)) {
    return meterTemplate;
  }
  if (/(tag|tracker|uwb|gps|rfid|vehicle|vessel|asset|visitor|personnel|axle_counter)/.test(code)) {
    return trackingTemplate;
  }
  if (/(sensor|detector|station|monitor|thermostat|temperature|noise|soil|radiation|uv|barometer|occupancy|oximeter|logger)/.test(code)) {
    return sensorTemplate;
  }
  return controllerTemplate;
}

function publishedCategoryVersion(
  categoryCode: string,
  categoryVersion: string,
  daysAgo: number,
  template: CategoryVersionView['template'],
  versionDigest: string,
): CategoryVersionView {
  return {
    categoryCode,
    categoryVersion,
    versionStatus: 'PUBLISHED',
    template,
    versionDigest,
    publishedAt: now - daysAgo * 86_400_000,
    createdAt: now - (daysAgo + 2) * 86_400_000,
  };
}

const categoryVersions: Record<string, CategoryVersionView[]> = {
  smart_lamp: [
    publishedCategoryVersion('smart_lamp', '2026.1', 18, lampTemplate, 'sha256:lamp-2026-1'),
  ],
  'sensor.env': [
    publishedCategoryVersion('sensor.env', '2026.2', 12, environmentTemplate, 'sha256:environment-sensor-2026-2'),
  ],
  'hvac.thermostat': [
    publishedCategoryVersion('hvac.thermostat', '2026.1', 20, thermostatTemplate, 'sha256:thermostat-2026-1'),
  ],
  'gateway.edge': [
    publishedCategoryVersion('gateway.edge', '2026.1', 23, gatewayTemplate, 'sha256:edge-gateway-2026-1'),
  ],
  'security.lock': [
    publishedCategoryVersion('security.lock', '2026.1', 16, lockTemplate, 'sha256:smart-lock-2026-1'),
  ],
};

seedCategories
  .filter((category) => category.leaf)
  .forEach((category, index) => {
    if (categoryVersions[category.categoryCode]) return;
    const digestCode = category.categoryCode.replace(/[^a-z0-9]+/gi, '-');
    categoryVersions[category.categoryCode] = [
      publishedCategoryVersion(
        category.categoryCode,
        '2026.1',
        4 + (index % 24),
        defaultTemplateForCategory(category.categoryCode),
        'sha256:' + digestCode + '-2026-1',
      ),
    ];
  });

const seedProducts: ProductRecord[] = [
  {
    projectId: 'proj_smart_home',
    productId: 'prod_thermostat_01',
    productName: '智能温控器',
    productModel: 'TH-100',
    categoryCode: 'hvac.thermostat',
    categoryName: '温控器',
    description: '用于酒店房间温度控制的产品。',
    manufacturer: 'ABC IoT',
    categoryCatalogVersion: '2026.1',
    nodeType: 'DIRECT',
    transport: 'MQTT',
    authModes: ['DEVICE_SECRET'],
    customAuthProviderId: null,
    dataMode: 'STANDARD_MODEL',
    bootstrapMode: 'OPEN',
    protocolProfile: null,
    topicTemplates: {},
    lifecycleStatus: 'PUBLISHED',
    version: 3,
    createdAt: Date.UTC(2026, 7, 8, 9, 0, 0),
    updatedAt: Date.UTC(2026, 7, 18, 10, 0, 0),
  },
  {
    projectId: 'proj_smart_home',
    productId: 'prod_gateway_01',
    productName: '边缘网关',
    productModel: 'GW-200',
    categoryCode: 'gateway.edge',
    categoryName: '边缘网关',
    description: '连接现场设备与云端服务的边缘网关。',
    manufacturer: 'ABC IoT',
    categoryCatalogVersion: '2026.1',
    nodeType: 'GATEWAY',
    transport: 'MQTT',
    authModes: ['PRODUCT_SECRET'],
    customAuthProviderId: null,
    dataMode: 'STANDARD_MODEL',
    bootstrapMode: 'STRICT',
    protocolProfile: null,
    topicTemplates: {},
    lifecycleStatus: 'DRAFT',
    version: 1,
    createdAt: Date.UTC(2026, 7, 12, 11, 0, 0),
    updatedAt: Date.UTC(2026, 7, 19, 14, 30, 0),
  },
  {
    projectId: 'proj_smart_home',
    productId: 'prod_sensor_01',
    productName: '温湿度传感器',
    productModel: 'STH-10',
    categoryCode: 'sensor.env',
    categoryName: '环境传感器',
    description: '采集房间温湿度与电池状态。',
    manufacturer: 'ABC IoT',
    categoryCatalogVersion: '2026.2',
    nodeType: 'DIRECT',
    transport: 'MQTT',
    authModes: ['DEVICE_SECRET'],
    customAuthProviderId: null,
    dataMode: 'STANDARD_MODEL',
    bootstrapMode: 'OPEN',
    protocolProfile: null,
    topicTemplates: {},
    lifecycleStatus: 'PUBLISHED',
    version: 2,
    createdAt: Date.UTC(2026, 7, 5, 14, 0, 0),
    updatedAt: Date.UTC(2026, 7, 15, 9, 12, 0),
  },
  {
    projectId: 'proj_smart_home',
    productId: 'prod_lock_01',
    productName: '智能门锁',
    productModel: 'LK-Pro',
    categoryCode: 'security.lock',
    categoryName: '智能门锁',
    description: '酒店房间门锁与门禁控制产品。',
    manufacturer: 'ABC IoT',
    categoryCatalogVersion: '2026.1',
    nodeType: 'DIRECT',
    transport: 'HTTPS',
    authModes: ['PRODUCT_SECRET'],
    customAuthProviderId: null,
    dataMode: 'STANDARD_MODEL',
    bootstrapMode: 'STRICT',
    protocolProfile: null,
    topicTemplates: {},
    lifecycleStatus: 'DISABLED',
    version: 2,
    createdAt: Date.UTC(2026, 7, 2, 16, 0, 0),
    updatedAt: Date.UTC(2026, 7, 10, 16, 45, 0),
  },
];

let accounts: AccountRecord[] = [seedAccount];
let projects: ProjectView[] = [...seedProjects];
let members: ProjectMemberView[] = [...seedMembers];
let invitations: InvitationView[] = [...seedInvitations];
let authorizations: AuthorizationMetadataView[] = [...seedAuthz];
let keyPairs: ProjectKeyPairView[] = [...seedKeyPairs];
let products: ProductRecord[] = [...seedProducts];
const categories: CategoryView[] = [...seedCategories];
const modelDrafts = new Map<string, ModelDraftView>();
const modelVersions = new Map<string, ModelVersionRecord[]>();
const modelValidations = new Map<string, { result: unknown }>();

function emptyThingModel(productId: string): ThingModelDefinition {
  return {
    productId,
    modelRevision: 0,
    modelDigest: '',
    status: 'DRAFT',
    properties: [],
    actions: [],
    events: [],
  };
}

function categoryThingModel(
  productId: string,
  categoryCode: string,
  revision = 0,
  status = 'DRAFT',
): ThingModelDefinition {
  const version = (categoryVersions[categoryCode] ?? []).find(
    (item) => item.versionStatus === 'PUBLISHED',
  );
  const template = version?.template;
  return {
    productId,
    modelRevision: revision,
    modelDigest: revision > 0 ? `sha256:model-${productId}-${revision}` : '',
    status,
    properties: clone(template?.properties ?? []),
    actions: clone(template?.actions ?? []),
    events: clone(template?.events ?? []),
  };
}

function capabilitySummary(
  type: 'PROPERTY' | 'ACTION' | 'EVENT',
  item: { code: string; title: string; required?: boolean },
) {
  return {
    type,
    code: item.code,
    title: item.title,
    required: Boolean(item.required),
  };
}

function allCapabilitySummaries(definition: ThingModelDefinition) {
  return [
    ...definition.properties.map((item) => capabilitySummary('PROPERTY', item)),
    ...definition.actions.map((item) => capabilitySummary('ACTION', item)),
    ...definition.events.map((item) => capabilitySummary('EVENT', item)),
  ];
}

function seedThingModel(product: ProductRecord, revisionCount: number, draftStatus?: 'DRAFT' | 'VALIDATED') {
  if (revisionCount <= 0) return;

  const revisions: ModelVersionRecord[] = [];
  for (let revision = 1; revision <= revisionCount; revision += 1) {
    const definition = categoryThingModel(
      product.productId,
      product.categoryCode,
      revision,
      'PUBLISHED',
    );
    if (revision > 1 && definition.properties.length > 0) {
      definition.properties = [
        ...definition.properties,
        {
          code: 'signalStrength',
          title: '信号强度',
          access: 'READ_ONLY',
          schema: { type: 'integer', minimum: 0, maximum: 100, unit: '%' },
          required: false,
        },
      ];
    }
    revisions.push({
      modelRevision: revision,
      modelDigest: definition.modelDigest,
      status: 'PUBLISHED',
      definition,
    });
  }
  modelVersions.set(product.productId, revisions);

  if (draftStatus) {
    const latest = revisions[revisions.length - 1].definition;
    modelDrafts.set(product.productId, {
      definition: {
        ...clone(latest),
        modelRevision: 0,
        modelDigest: '',
        status: 'DRAFT',
      },
      status: draftStatus,
      version: 2,
    });
  }
}

seedThingModel(seedProducts[0], 2, 'VALIDATED');
seedThingModel(seedProducts[2], 1, 'DRAFT');
seedThingModel(seedProducts[3], 1);

/** accessToken → accountId */
const sessions = new Map<string, string>();
/** refreshToken → accountId */
const refreshTokens = new Map<string, string>();

function findAccountByIdentifier(identifier: string): AccountRecord | undefined {
  const value = identifier.trim().toLowerCase();
  return accounts.find(
    (a) =>
      a.username.toLowerCase() === value ||
      a.email?.toLowerCase() === value ||
      a.phone === identifier.trim(),
  );
}

function setProjectStatus(projectId: string, status: string): ProjectView | null {
  const idx = projects.findIndex((p) => p.projectId === projectId);
  if (idx < 0) return null;
  const updated: ProjectView = {
    ...projects[idx],
    status,
    updateTime: Date.now(),
  };
  projects[idx] = updated;
  return updated;
}

function toProductListItem(product: ProductRecord): ProductListItem {
  return {
    productId: product.productId,
    productName: product.productName,
    productModel: product.productModel,
    categoryCode: product.categoryCode,
    categoryName: product.categoryName,
    categoryNames: product.categoryNames,
    lifecycleStatus: product.lifecycleStatus,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt,
  };
}

function toProductDetailView(product: ProductRecord): ProductDetailView {
  return clone(product);
}

function findCategory(categoryCode: string): CategoryView | undefined {
  return categories.find((category) => category.categoryCode === categoryCode);
}

function findProduct(productId: string): ProductRecord | undefined {
  return products.find((product) => product.productId === productId);
}

function findPublishedModel(productId: string): ModelVersionRecord | undefined {
  const versions = modelVersions.get(productId) ?? [];
  const published = versions.filter((version) => version.status === 'PUBLISHED');
  return published[published.length - 1];
}

function productPublishPrecheckFailure(product: ProductRecord) {
  if (!findPublishedModel(product.productId)) {
    return {
      code: 'MODEL_NOT_PUBLISHED',
      message: '产品物模型尚未发布',
      status: 409,
    };
  }

  if (
    !product.nodeType ||
    !product.transport ||
    product.authModes.length === 0
  ) {
    return {
      code: 'PARAM_INVALID',
      message: '连接配置不完整：节点类型、传输协议和认证方式必须填写',
      status: 400,
    };
  }

  if (!product.categoryCatalogVersion) {
    return {
      code: 'CATEGORY_VERSION_UNAVAILABLE',
      message: '产品尚未绑定品类模板版本',
      status: 409,
    };
  }

  const categoryVersion = (categoryVersions[product.categoryCode] ?? []).find(
    (version) => version.categoryVersion === product.categoryCatalogVersion,
  );
  if (!categoryVersion || categoryVersion.versionStatus !== 'PUBLISHED') {
    return {
      code: 'CATEGORY_VERSION_UNAVAILABLE',
      message: '品类版本尚未发布或已废弃',
      status: 409,
    };
  }

  const dataMode = product.dataMode ?? 'STANDARD_MODEL';
  const profile = product.protocolProfile;
  if (
    dataMode === 'CUSTOM_PAYLOAD' &&
    (!profile?.profileId || !profile.profileVersion)
  ) {
    return {
      code: 'PROFILE_UNAVAILABLE',
      message: '自定义报文模式必须绑定已发布 Parser Profile 版本',
      status: 409,
    };
  }

  return null;
}

function getDraftDefinition(productId: string): ThingModelDefinition {
  return clone(modelDrafts.get(productId)?.definition ?? emptyThingModel(productId));
}

function schemaEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function modelDiff(from: ThingModelDefinition, to: ThingModelDefinition): ModelDiffView {
  const diff = (type: 'PROPERTY' | 'ACTION' | 'EVENT', source: ThingModelDefinition, target: ThingModelDefinition) => {
    const sourceItems = type === 'PROPERTY'
      ? source.properties
      : type === 'ACTION'
        ? source.actions
        : source.events;
    const targetItems = type === 'PROPERTY'
      ? target.properties
      : type === 'ACTION'
        ? target.actions
        : target.events;
    const sourceByCode = new Map(sourceItems.map((item) => [item.code, item]));
    const targetByCode = new Map(targetItems.map((item) => [item.code, item]));
    return {
      added: targetItems
        .filter((item) => !sourceByCode.has(item.code))
        .map((item) => capabilitySummary(type, item)),
      removed: sourceItems
        .filter((item) => !targetByCode.has(item.code))
        .map((item) => capabilitySummary(type, item)),
      modified: targetItems
        .filter((item) => {
          const previous = sourceByCode.get(item.code);
          return previous != null && !schemaEqual(previous, item);
        })
        .map((item) => capabilitySummary(type, item)),
    };
  };

  const propertyDiff = diff('PROPERTY', from, to);
  const actionDiff = diff('ACTION', from, to);
  const eventDiff = diff('EVENT', from, to);
  return {
    added: [...propertyDiff.added, ...actionDiff.added, ...eventDiff.added],
    removed: [...propertyDiff.removed, ...actionDiff.removed, ...eventDiff.removed],
    modified: [...propertyDiff.modified, ...actionDiff.modified, ...eventDiff.modified],
  };
}

export const OpenPlatformHandlers = [
  http.get('/api/v1/mock/health', () => {
    return HttpResponse.json(
      ok({ mocked: true }),
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }),

  http.get('/api/v1/categories', () => {
    return HttpResponse.json(ok(categories));
  }),

  http.get('/api/v1/categories/:categoryCode/versions', ({ params }) => {
    const categoryCode = decodeURIComponent(String(params.categoryCode));
    const category = findCategory(categoryCode);
    if (!category) return fail('404', 'Category not found', 404);
    return HttpResponse.json(ok(categoryVersions[categoryCode] ?? []));
  }),

  http.get('/api/v1/categories/:categoryCode/versions/:categoryVersion', ({ params }) => {
    const categoryCode = decodeURIComponent(String(params.categoryCode));
    const categoryVersion = decodeURIComponent(String(params.categoryVersion));
    const category = findCategory(categoryCode);
    if (!category) return fail('404', 'Category not found', 404);
    const version = (categoryVersions[categoryCode] ?? []).find(
      (item) => item.categoryVersion === categoryVersion,
    );
    if (!version) return fail('404', 'Category version not found', 404);
    return HttpResponse.json(ok(version));
  }),

  http.get('/api/v1/categories/:categoryCode', ({ params }) => {
    const categoryCode = decodeURIComponent(String(params.categoryCode));
    const category = findCategory(categoryCode);
    if (!category) return fail('404', 'Category not found', 404);
    return HttpResponse.json(ok(category));
  }),

  http.get('/api/v1/products/:productId', ({ params }) => {
    const product = findProduct(String(params.productId));
    if (!product) return fail('404', 'Product not found', 404);
    return HttpResponse.json(ok(toProductDetailView(product)));
  }),

  http.put('/api/v1/products/:productId', async ({ params, request }) => {
    try {
      const productId = String(params.productId);
      const product = findProduct(productId);
      if (!product) return fail('PRODUCT_NOT_FOUND', '产品不存在', 404);
      if (product.lifecycleStatus !== 'DRAFT') {
        return fail('PRODUCT_NOT_DRAFT', '产品不在草稿状态，不能修改', 409);
      }

      const body = (await request.json()) as ProductUpdateRequest & {
        categoryCode?: string;
        categoryCatalogVersion?: string;
      };
      if (String(body?.version ?? '') !== String(product.version)) {
        return fail('VERSION_MISMATCH', '产品已发生变化，请刷新后再试。', 412);
      }
      if (body.categoryCode && body.categoryCode !== product.categoryCode) {
        return fail('PARAM_INVALID', '产品所属品类创建后不可修改。', 400);
      }
      if (
        body.categoryCatalogVersion &&
        body.categoryCatalogVersion !== product.categoryCatalogVersion
      ) {
        return fail('PARAM_INVALID', '产品绑定的品类版本不可修改。', 400);
      }

      const productName = body.productName?.trim();
      if (productName) {
        const duplicate = products.some(
          (item) =>
            item.productId !== productId &&
            item.productName.trim().toLowerCase() === productName.toLowerCase(),
        );
        if (duplicate) return fail('PRODUCT_NAME_DUPLICATE', '产品名称已存在。', 409);
        product.productName = productName;
      }
      if (body.productModel?.trim()) product.productModel = body.productModel.trim();
      if (body.description?.trim()) product.description = body.description.trim();
      if (body.manufacturer?.trim()) product.manufacturer = body.manufacturer.trim();
      if (body.iconUrl?.trim()) product.iconUrl = body.iconUrl.trim();

      const hasConnectionPatch = [
        'nodeType',
        'transport',
        'authModes',
        'customAuthProviderId',
        'dataMode',
        'bootstrapMode',
        'protocolProfile',
        'topicTemplates',
      ].some((key) => Object.prototype.hasOwnProperty.call(body, key));
      if (hasConnectionPatch) {
        product.nodeType = body.nodeType ?? null;
        product.transport = body.transport ?? null;
        product.authModes = Array.isArray(body.authModes) ? [...body.authModes] : [];
        product.customAuthProviderId = body.customAuthProviderId ?? null;
        product.dataMode = body.dataMode ?? null;
        product.bootstrapMode = body.bootstrapMode ?? null;
        product.protocolProfile = body.protocolProfile ?? null;
        product.topicTemplates = body.topicTemplates ?? {};
      }

      product.version += 1;
      product.updatedAt = Date.now();
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/products/:productId/publish/validate', ({ params }) => {
    const product = findProduct(String(params.productId));
    if (!product) return fail('PRODUCT_NOT_FOUND', '产品不存在', 404);
    const failure = productPublishPrecheckFailure(product);
    return failure ? fail(failure.code, failure.message, failure.status) : HttpResponse.json(ok(true));
  }),

  http.post('/api/v1/products/:productId/publish', async ({ params, request }) => {
    try {
      const product = findProduct(String(params.productId));
      if (!product) return fail('PRODUCT_NOT_FOUND', '产品不存在', 404);
      const body = (await request.json()) as { version?: number | string | null };
      if (product.lifecycleStatus !== 'DRAFT') {
        return fail('INVALID_LIFECYCLE_TRANSITION', '只有草稿产品可以发布。', 409);
      }
      if (String(body?.version ?? '') !== String(product.version)) {
        return fail('VERSION_MISMATCH', '产品已发生变化，请刷新后再发布。', 412);
      }
      const failure = productPublishPrecheckFailure(product);
      if (failure) return fail(failure.code, failure.message, failure.status);
      product.lifecycleStatus = 'PUBLISHED';
      product.version += 1;
      product.updatedAt = Date.now();
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/products/:productId/disable', async ({ params, request }) => {
    try {
      const product = findProduct(String(params.productId));
      if (!product) return fail('PRODUCT_NOT_FOUND', '产品不存在', 404);
      const body = (await request.json()) as { version?: number | string | null };
      if (product.lifecycleStatus !== 'PUBLISHED') {
        return fail('INVALID_LIFECYCLE_TRANSITION', '只有已发布产品可以停用。', 409);
      }
      if (String(body?.version ?? '') !== String(product.version)) {
        return fail('VERSION_MISMATCH', '产品已发生变化，请刷新后再停用。', 412);
      }
      product.lifecycleStatus = 'DISABLED';
      product.version += 1;
      product.updatedAt = Date.now();
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/products/:productId/enable', async ({ params, request }) => {
    try {
      const product = findProduct(String(params.productId));
      if (!product) return fail('PRODUCT_NOT_FOUND', '产品不存在', 404);
      const body = (await request.json()) as { version?: number | string | null };
      if (product.lifecycleStatus !== 'DISABLED') {
        return fail('INVALID_LIFECYCLE_TRANSITION', '只有已停用产品可以恢复启用。', 409);
      }
      if (String(body?.version ?? '') !== String(product.version)) {
        return fail('VERSION_MISMATCH', '产品已发生变化，请刷新后再恢复。', 412);
      }
      product.lifecycleStatus = 'PUBLISHED';
      product.version += 1;
      product.updatedAt = Date.now();
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/products/:productId/deprecate', async ({ params, request }) => {
    try {
      const product = findProduct(String(params.productId));
      if (!product) return fail('PRODUCT_NOT_FOUND', '产品不存在', 404);
      const body = (await request.json()) as { version?: number | string | null };
      if (!['PUBLISHED', 'DISABLED'].includes(product.lifecycleStatus)) {
        return fail('INVALID_LIFECYCLE_TRANSITION', '只有已发布或已停用产品可以废弃。', 409);
      }
      if (String(body?.version ?? '') !== String(product.version)) {
        return fail('VERSION_MISMATCH', '产品已发生变化，请刷新后再废弃。', 412);
      }
      product.lifecycleStatus = 'DEPRECATED';
      product.version += 1;
      product.updatedAt = Date.now();
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.delete('/api/v1/products/:productId', async ({ params, request }) => {
    try {
      const productId = String(params.productId);
      const product = findProduct(productId);
      if (!product) return fail('PRODUCT_NOT_FOUND', '产品不存在', 404);
      const body = (await request.json()) as { version?: number | string | null };
      if (product.lifecycleStatus !== 'DRAFT') {
        return fail('PRODUCT_NOT_DRAFT', '只有草稿产品可以删除。', 409);
      }
      if (String(body?.version ?? '') !== String(product.version)) {
        return fail('VERSION_MISMATCH', '产品已发生变化，请刷新后再删除。', 412);
      }
      products = products.filter((item) => item.productId !== productId);
      modelDrafts.delete(productId);
      modelVersions.delete(productId);
      modelValidations.delete(productId);
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/products/:productId/model', ({ params }) => {
    const productId = String(params.productId);
    if (!findProduct(productId)) return fail('404', 'Product not found', 404);
    const draft = modelDrafts.get(productId);
    return HttpResponse.json(ok(draft ? clone(draft) : null));
  }),

  http.put('/api/v1/products/:productId/model', async ({ params, request }) => {
    try {
      const productId = String(params.productId);
      const product = findProduct(productId);
      if (!product) return fail('404', 'Product not found', 404);

      const body = (await request.json()) as {
        version?: number | string | null;
        definition?: ThingModelDefinition;
      };
      const current = modelDrafts.get(productId);
      if (current && String(body?.version ?? '') !== String(current.version ?? '')) {
        return fail('VERSION_MISMATCH', '物模型草稿已发生变化，请刷新后再保存。', 412);
      }
      const definition = body?.definition;
      if (!definition || !Array.isArray(definition.properties) || !Array.isArray(definition.actions) || !Array.isArray(definition.events)) {
        return fail('PARAM_INVALID', '物模型定义不完整。', 400);
      }

      const nextDefinition: ThingModelDefinition = {
        ...clone(definition),
        productId,
        modelRevision: 0,
        modelDigest: '',
        status: 'DRAFT',
      };
      modelDrafts.set(productId, {
        definition: nextDefinition,
        status: 'DRAFT',
        version: (current?.version ?? 0) + 1,
      });
      modelValidations.delete(productId);
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.delete('/api/v1/products/:productId/model', async ({ params, request }) => {
    try {
      const productId = String(params.productId);
      if (!findProduct(productId)) return fail('404', 'Product not found', 404);
      const current = modelDrafts.get(productId);
      if (!current) return fail('DRAFT_NOT_FOUND', '当前没有物模型草稿。', 404);
      const body = (await request.json()) as { version?: number | string };
      if (String(body?.version ?? '') !== String(current.version ?? '')) {
        return fail('VERSION_MISMATCH', '物模型草稿已发生变化，请刷新后再试。', 412);
      }
      modelDrafts.delete(productId);
      modelValidations.delete(productId);
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/products/:productId/model/validate', ({ params }) => {
    const productId = String(params.productId);
    if (!findProduct(productId)) return fail('404', 'Product not found', 404);
    const draft = modelDrafts.get(productId);
    if (!draft) return fail('DRAFT_NOT_FOUND', '请先创建物模型草稿。', 404);
    const codes = allCapabilitySummaries(draft.definition).map((item) => item.code);
    const valid = new Set(codes).size === codes.length && codes.length > 0;
    const result = {
      valid,
      evaluationPath: '$',
      schemaLocation: '#/definitions/thing-model',
      instanceLocation: '$',
      errors: valid ? [] : [{ message: '物模型至少需要包含一项能力，且能力 code 不能重复。' }],
      annotations: [],
      droppedAnnotations: [],
      details: [],
    };
    modelValidations.set(productId, { result });
    draft.status = valid ? 'VALIDATED' : 'DRAFT';
    return HttpResponse.json(ok(result));
  }),

  http.post('/api/v1/products/:productId/model/publish', async ({ params, request }) => {
    try {
      const productId = String(params.productId);
      if (!findProduct(productId)) return fail('404', 'Product not found', 404);
      const draft = modelDrafts.get(productId);
      if (!draft) return fail('DRAFT_NOT_FOUND', '请先创建物模型草稿。', 404);
      const body = (await request.json()) as { version?: number | string };
      if (String(body?.version ?? '') !== String(draft.version ?? '')) {
        return fail('VERSION_MISMATCH', '物模型草稿已发生变化，请刷新后再发布。', 412);
      }
      if (draft.status !== 'VALIDATED') {
        return fail('DRAFT_NOT_VALIDATED', '草稿尚未通过校验，请先执行校验。', 409);
      }

      const previous = modelVersions.get(productId) ?? [];
      const revision = (previous[previous.length - 1]?.modelRevision ?? 0) + 1;
      const definition: ThingModelDefinition = {
        ...clone(draft.definition),
        modelRevision: revision,
        modelDigest: `sha256:model-${productId}-${revision}-${draft.version}`,
        status: 'PUBLISHED',
      };
      modelVersions.set(productId, [
        ...previous.map((item) => ({ ...item, status: 'DEPRECATED' as const })),
        {
          modelRevision: revision,
          modelDigest: definition.modelDigest,
          status: 'PUBLISHED',
          definition,
        },
      ] as ModelVersionRecord[]);
      draft.definition = {
        ...clone(draft.definition),
        modelRevision: 0,
        modelDigest: '',
        status: 'DRAFT',
      };
      draft.status = 'DRAFT';
      modelValidations.delete(productId);
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/products/:productId/model/versions', ({ params }) => {
    const productId = String(params.productId);
    if (!findProduct(productId)) return fail('404', 'Product not found', 404);
    return HttpResponse.json(
      ok((modelVersions.get(productId) ?? []).map(({ definition: _definition, ...summary }) => summary)),
    );
  }),

  http.get('/api/v1/products/:productId/model/versions/:modelRevision', ({ params }) => {
    const productId = String(params.productId);
    const revision = Number(params.modelRevision);
    const version = (modelVersions.get(productId) ?? []).find(
      (item) => item.modelRevision === revision,
    );
    if (!version) return fail('MODEL_REVISION_NOT_FOUND', '物模型版本不存在。', 404);
    return HttpResponse.json(ok(clone(version.definition)));
  }),

  http.get('/api/v1/products/:productId/model/published', ({ params }) => {
    const productId = String(params.productId);
    if (!findProduct(productId)) return fail('404', 'Product not found', 404);
    return HttpResponse.json(ok(clone(findPublishedModel(productId)?.definition ?? null)));
  }),

  http.post('/api/v1/products/:productId/model/diff', async ({ params, request }) => {
    const productId = String(params.productId);
    const body = (await request.json()) as {
      fromRevision?: number;
      toRevision?: number;
    };
    const versions = modelVersions.get(productId) ?? [];
    const from = versions.find((item) => item.modelRevision === Number(body?.fromRevision));
    const to = versions.find((item) => item.modelRevision === Number(body?.toRevision));
    if (!from || !to || from.modelRevision >= to.modelRevision) {
      return fail('MODEL_DIFF_INVALID', '请选择有效的版本范围。', 400);
    }
    return HttpResponse.json(ok(modelDiff(from.definition, to.definition)));
  }),

  http.post('/api/v1/products/:productId/model/rollback', async ({ params, request }) => {
    try {
      const productId = String(params.productId);
      const versions = modelVersions.get(productId) ?? [];
      const body = (await request.json()) as {
        fromRevision?: number;
        version?: number | string | null;
      };
      const source = versions.find((item) => item.modelRevision === Number(body?.fromRevision));
      if (!source) return fail('MODEL_REVISION_NOT_FOUND', '物模型版本不存在。', 404);
      const current = modelDrafts.get(productId);
      if (current && String(body?.version ?? '') !== String(current.version ?? '')) {
        return fail('VERSION_MISMATCH', '当前草稿已发生变化，请刷新后再回滚。', 412);
      }
      modelDrafts.set(productId, {
        definition: {
          ...clone(source.definition),
          modelRevision: 0,
          modelDigest: '',
          status: 'DRAFT',
        },
        status: 'DRAFT',
        version: (current?.version ?? 0) + 1,
      });
      modelValidations.delete(productId);
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/products/:productId/model/validation', ({ params }) => {
    const productId = String(params.productId);
    if (!findProduct(productId)) return fail('404', 'Product not found', 404);
    return HttpResponse.json(ok(modelValidations.get(productId)?.result ?? null));
  }),

  http.get('/api/v1/products/:productId/model/category-diff', ({ params, request }) => {
    const productId = String(params.productId);
    const product = findProduct(productId);
    if (!product) return fail('404', 'Product not found', 404);
    const targetVersion = new URL(request.url).searchParams.get('targetVersion') ?? '';
    const categoryVersion = (categoryVersions[product.categoryCode] ?? []).find(
      (item) => item.categoryVersion === targetVersion,
    );
    if (!categoryVersion) return fail('CATEGORY_VERSION_NOT_FOUND', '品类版本不存在。', 404);
    const current = getDraftDefinition(productId);
    const template: ThingModelDefinition = {
      ...categoryThingModel(productId, product.categoryCode),
      properties: clone(categoryVersion.template.properties),
      actions: clone(categoryVersion.template.actions),
      events: clone(categoryVersion.template.events),
    };
    const diff = modelDiff(current, template);
    return HttpResponse.json(ok({ diffItems: diff.added } satisfies CategoryMergeView));
  }),

  http.post('/api/v1/products/:productId/model/category-merge', async ({ params, request }) => {
    try {
      const productId = String(params.productId);
      const product = findProduct(productId);
      if (!product) return fail('404', 'Product not found', 404);
      const body = (await request.json()) as {
        targetVersion?: string;
        selectedCodes?: string[];
        version?: number | string | null;
      };
      const categoryVersion = (categoryVersions[product.categoryCode] ?? []).find(
        (item) => item.categoryVersion === body?.targetVersion,
      );
      if (!categoryVersion) return fail('CATEGORY_VERSION_NOT_FOUND', '品类版本不存在。', 404);
      const currentDraft = modelDrafts.get(productId);
      if (currentDraft && String(body?.version ?? '') !== String(currentDraft.version ?? '')) {
        return fail('VERSION_MISMATCH', '当前草稿已发生变化，请刷新后再合并。', 412);
      }

      const current = getDraftDefinition(productId);
      const template: ThingModelDefinition = {
        ...categoryThingModel(productId, product.categoryCode),
        properties: clone(categoryVersion.template.properties),
        actions: clone(categoryVersion.template.actions),
        events: clone(categoryVersion.template.events),
      };
      const available = modelDiff(current, template).added;
      const availableCodes = new Set(available.map((item) => item.code));
      const selected = new Set(body?.selectedCodes ?? []);
      available.filter((item) => item.required).forEach((item) => selected.add(item.code));
      if ([...selected].some((code) => !availableCodes.has(code))) {
        return fail('CATEGORY_MERGE_INVALID', '选中的能力不在品类升级清单中。', 400);
      }

      const selectedCodes = selected;
      template.properties
        .filter((item) => selectedCodes.has(item.code) && !current.properties.some((existing) => existing.code === item.code))
        .forEach((item) => current.properties.push(clone(item)));
      template.actions
        .filter((item) => selectedCodes.has(item.code) && !current.actions.some((existing) => existing.code === item.code))
        .forEach((item) => current.actions.push(clone(item)));
      template.events
        .filter((item) => selectedCodes.has(item.code) && !current.events.some((existing) => existing.code === item.code))
        .forEach((item) => current.events.push(clone(item)));
      modelDrafts.set(productId, {
        definition: { ...current, modelRevision: 0, modelDigest: '', status: 'DRAFT' },
        status: 'DRAFT',
        version: (currentDraft?.version ?? 0) + 1,
      });
      modelValidations.delete(productId);
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/auth/register', async ({ request }) => {
    try {
      const body = (await request.json()) as RegisterRequest;
      if (!body?.username?.trim() || !body?.password) {
        return fail('400', 'username and password are required');
      }
      const exists = accounts.some(
        (a) => a.username.toLowerCase() === body.username.trim().toLowerCase(),
      );
      if (exists) {
        return fail('409', 'username already registered', 409);
      }
      const ts = Date.now();
      const account: AccountRecord = {
        accountId: newId('acc'),
        username: body.username.trim(),
        email: body.email?.trim() || null,
        phone: body.phone?.trim() || null,
        status: 'ACTIVE',
        securityVersion: 1,
        createTime: ts,
        updateTime: ts,
        password: body.password,
      };
      accounts.push(account);
      const result: RegisterResult = {
        registered: true,
        accountId: account.accountId,
        status: account.status,
      };
      return HttpResponse.json(ok(result));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/auth/login', async ({ request }) => {
    try {
      const body = (await request.json()) as LoginRequest;
      if (!body?.identifier || !body?.password || body.clientType !== 'CONSOLE') {
        return fail('400', 'identifier, password, and clientType CONSOLE are required');
      }
      const account = findAccountByIdentifier(body.identifier);
      if (!account || account.password !== body.password) {
        return fail('401', 'Invalid credentials', 401);
      }
      if (account.status !== 'ACTIVE') {
        return fail('403', 'Account is not active', 403);
      }
      return HttpResponse.json(ok(issueTokens(account.accountId)));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/auth/token/refresh', async ({ request }) => {
    try {
      const body = (await request.json()) as RefreshRequest;
      if (!body?.refreshToken) {
        return fail('400', 'refreshToken is required');
      }
      const accountId = refreshTokens.get(body.refreshToken);
      if (!accountId) {
        return fail('401', 'Invalid refresh token', 401);
      }
      refreshTokens.delete(body.refreshToken);
      return HttpResponse.json(ok(issueTokens(accountId)));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/auth/logout', async ({ request }) => {
    try {
      let refreshToken: string | undefined;
      try {
        const body = (await request.json()) as LogoutRequest;
        refreshToken = body?.refreshToken;
      } catch {
        refreshToken = undefined;
      }
      if (refreshToken) {
        refreshTokens.delete(refreshToken);
      }
      const accountId = resolveBearerAccountId(request);
      if (accountId) {
        for (const [token, id] of sessions.entries()) {
          if (id === accountId) sessions.delete(token);
        }
      }
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/auth/me', ({ request }) => {
    try {
      const accountId = resolveBearerAccountId(request);
      // Mock convenience: if no Bearer, return the seed demo account.
      const account =
        accounts.find((a) => a.accountId === (accountId ?? seedAccount.accountId)) ??
        accounts[0];
      if (!account) {
        return fail('401', 'Unauthorized', 401);
      }
      return HttpResponse.json(ok(toAccountView(account)));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects', async ({ request }) => {
    try {
      const body = (await request.json()) as CreateProjectRequest;
      if (!body?.projectName?.trim()) {
        return fail('400', 'projectName is required');
      }
      const accountId = resolveBearerAccountId(request) ?? seedAccount.accountId;
      const account =
        accounts.find((a) => a.accountId === accountId) ?? seedAccount;
      const ts = Date.now();
      const projectId = newId('proj');
      const project: ProjectView = {
        projectId,
        projectName: body.projectName.trim(),
        description: body.description?.trim() || null,
        status: 'ACTIVE',
        myRole: 'OWNER',
        createTime: ts,
        updateTime: ts,
      };
      const ownerMember: ProjectMemberView = {
        projectId,
        accountId: account.accountId,
        username: account.username,
        email: account.email,
        role: 'OWNER',
        membershipStatus: 'ACTIVE',
        joinedAt: ts,
        createTime: ts,
        updateTime: ts,
      };
      const keyPair: ProjectKeyPairView = {
        projectId,
        clientId: newId('cli'),
        clientSecret: newId('sec'),
      };
      const authz: AuthorizationMetadataView = {
        projectId,
        status: 'ACTIVE',
        ipAllowlist: [],
        networkPolicyEnabled: false,
        createTime: ts,
        lastRotatedAt: null,
        lastUsedAt: null,
      };
      projects = [project, ...projects];
      members = [ownerMember, ...members];
      keyPairs = [keyPair, ...keyPairs];
      authorizations = [authz, ...authorizations];
      const result: CreateProjectResult = { project, ownerMember, keyPair };
      return HttpResponse.json(ok(result));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/projects', ({ request }) => {
    try {
      const url = new URL(request.url);
      const cursor = url.searchParams.get('cursor');
      const pageSizeRaw = url.searchParams.get('pageSize');
      const keyword = url.searchParams.get('keyword')?.trim().toLowerCase() ?? '';
      const status = url.searchParams.get('status')?.trim() ?? '';
      const pageSize = Math.min(Math.max(Number(pageSizeRaw) || 20, 1), 100);

      const accountId = resolveBearerAccountId(request) ?? seedAccount.accountId;
      const memberProjectIds = new Set(
        members
          .filter(
            (m) => m.accountId === accountId && m.membershipStatus !== 'REMOVED',
          )
          .map((m) => m.projectId),
      );

      let filtered = projects
        .filter((p) => memberProjectIds.has(p.projectId))
        .map((p) => projectViewFor(accountId, p));

      if (keyword) {
        filtered = filtered.filter(
          (p) =>
            p.projectName.toLowerCase().includes(keyword) ||
            p.projectId.toLowerCase().includes(keyword),
        );
      }
      if (status) {
        filtered = filtered.filter((p) => p.status === status);
      }

      const start = cursor ? Number(cursor) || 0 : 0;
      const slice = filtered.slice(start, start + pageSize);
      const nextIndex = start + slice.length;
      const hasMore = nextIndex < filtered.length;
      const data: CursorResult<ProjectView> = {
        items: slice,
        nextCursor: hasMore ? String(nextIndex) : null,
        hasMore,
      };
      return HttpResponse.json(ok(data));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/projects/:projectId', ({ params, request }) => {
    try {
      const projectId = String(params.projectId);
      const project = projects.find((p) => p.projectId === projectId);
      if (!project) {
        return fail('404', 'Project not found', 404);
      }
      const accountId = resolveBearerAccountId(request) ?? seedAccount.accountId;
      return HttpResponse.json(ok(projectViewFor(accountId, project)));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.put('/api/v1/projects/:projectId', async ({ params, request }) => {
    try {
      const projectId = String(params.projectId);
      const idx = projects.findIndex((p) => p.projectId === projectId);
      if (idx < 0) {
        return fail('404', 'Project not found', 404);
      }
      const body = (await request.json()) as UpdateProjectRequest;
      const current = projects[idx];
      const updated: ProjectView = {
        ...current,
        projectName:
          body.projectName !== undefined
            ? body.projectName.trim()
            : current.projectName,
        description:
          body.description !== undefined
            ? body.description?.trim() || null
            : current.description,
        updateTime: Date.now(),
      };
      projects[idx] = updated;
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/activate', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const project = projects.find((p) => p.projectId === projectId);
      if (!project) {
        return fail('404', 'Project not found', 404);
      }
      if (project.status === 'CLOSED') {
        return fail('409', 'Closed projects cannot be activated', 409);
      }
      setProjectStatus(projectId, 'ACTIVE');
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/suspend', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const project = projects.find((p) => p.projectId === projectId);
      if (!project) {
        return fail('404', 'Project not found', 404);
      }
      if (project.status !== 'ACTIVE') {
        return fail('409', 'Only ACTIVE projects can be suspended', 409);
      }
      setProjectStatus(projectId, 'SUSPENDED');
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/archive', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const project = projects.find((p) => p.projectId === projectId);
      if (!project) {
        return fail('404', 'Project not found', 404);
      }
      if (project.status === 'CLOSED' || project.status === 'ARCHIVED') {
        return fail('409', `Cannot archive project in status ${project.status}`, 409);
      }
      setProjectStatus(projectId, 'ARCHIVED');
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/close', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const project = projects.find((p) => p.projectId === projectId);
      if (!project) {
        return fail('404', 'Project not found', 404);
      }
      if (project.status === 'CLOSED') {
        return fail('409', 'Project already closed', 409);
      }
      setProjectStatus(projectId, 'CLOSED');
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/projects/:projectId/summary', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      if (!projects.some((project) => project.projectId === projectId)) {
        return fail('404', 'Project not found', 404);
      }
      const memberCount = members.filter(
        (member) =>
          member.projectId === projectId && member.membershipStatus !== 'REMOVED',
      ).length;
      const productCount = products.filter(
        (product) => product.projectId === projectId,
      ).length;
      const summary: ProjectSummaryView = {
        projectId,
        resourceCounts: {
          products: productCount,
          devices: 0,
          rules: 0,
          groups: 0,
        },
        memberCount,
        productCount,
        deviceCount: 0,
        lastActivityAt: null,
      };
      return HttpResponse.json(ok(summary));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/projects/:projectId/products', ({ params, request }) => {
    try {
      const projectId = String(params.projectId);
      if (!projects.some((project) => project.projectId === projectId)) {
        return fail('404', 'Project not found', 404);
      }

      const url = new URL(request.url);
      const cursor = url.searchParams.get('cursor');
      const keyword = url.searchParams.get('keyword')?.trim().toLowerCase() ?? '';
      const status = url.searchParams.get('status')?.trim() ?? '';
      const pageSize = Math.min(
        100,
        Math.max(1, Number(url.searchParams.get('pageSize') ?? 20) || 20),
      );

      let filtered = products.filter((product) => product.projectId === projectId);
      if (keyword) {
        filtered = filtered.filter((product) =>
          [
            product.productName,
            product.productId,
            product.productModel ?? '',
            product.categoryCode,
          ].some((value) => value.toLowerCase().includes(keyword)),
        );
      }
      if (status) {
        filtered = filtered.filter((product) => product.lifecycleStatus === status);
      }

      const start = cursor ? Number(cursor) || 0 : 0;
      const slice = filtered.slice(start, start + pageSize);
      const nextIndex = start + slice.length;
      const data: CursorResult<ProductListItem> = {
        items: slice.map(toProductListItem),
        nextCursor: nextIndex < filtered.length ? String(nextIndex) : null,
        hasMore: nextIndex < filtered.length,
      };
      return HttpResponse.json(ok(data));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/products', async ({ params, request }) => {
    try {
      const projectId = String(params.projectId);
      const project = projects.find((item) => item.projectId === projectId);
      if (!project) {
        return fail('404', 'Project not found', 404);
      }
      if (project.status !== 'ACTIVE') {
        return fail(
          'PROJECT_NOT_ACTIVE',
          `Project is ${project.status}; products can only be created in ACTIVE projects`,
          409,
        );
      }

      const body = (await request.json()) as ProductCreateRequest;
      const productName = body?.productName?.trim() ?? '';
      const productModel = body?.productModel?.trim() ?? '';
      const categoryCode = body?.categoryCode?.trim() ?? '';
      const category = findCategory(categoryCode);

      if (!productName) {
        return fail('400', 'productName is required');
      }
      if (productName.length > 128) {
        return fail('400', 'productName cannot exceed 128 characters');
      }
      if (!category) {
        return fail('CATEGORY_NOT_FOUND', '请选择有效的品类', 400);
      }
      if (!category.leaf) {
        return fail('CATEGORY_LEAF_REQUIRED', '请选择一个叶子品类', 400);
      }
      if ((categoryVersions[categoryCode] ?? []).length === 0) {
        return fail(
          'CATEGORY_VERSION_NOT_PUBLISHED',
          '该品类暂无已发布版本，暂不能创建产品',
          409,
        );
      }

      const ts = Date.now();
      const product: ProductRecord = {
        projectId,
        productId: newId('prod'),
        productName,
        productModel: productModel || null,
        categoryCode,
        categoryName: categoryLabel(category),
        description: null,
        manufacturer: null,
        categoryCatalogVersion:
          categoryVersions[categoryCode]?.find((item) => item.versionStatus === 'PUBLISHED')
            ?.categoryVersion ?? null,
        nodeType: null,
        transport: null,
        authModes: [],
        customAuthProviderId: null,
        dataMode: null,
        bootstrapMode: null,
        protocolProfile: null,
        topicTemplates: {},
        lifecycleStatus: 'DRAFT',
        version: 1,
        createdAt: ts,
        updatedAt: ts,
      };
      products = [product, ...products];
      return HttpResponse.json(ok(toProductListItem(product)), { status: 201 });
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/projects/:projectId/members', ({ params, request }) => {
    try {
      const projectId = String(params.projectId);
      const url = new URL(request.url);
      const role = url.searchParams.get('role') ?? undefined;
      const membershipStatus = url.searchParams.get('membershipStatus') ?? undefined;
      const pageSize = Math.min(
        100,
        Math.max(1, Number(url.searchParams.get('pageSize') ?? 20) || 20),
      );
      let items = members.filter((m) => m.projectId === projectId);
      if (role) items = items.filter((m) => m.role === role);
      if (membershipStatus) {
        items = items.filter((m) => m.membershipStatus === membershipStatus);
      }
      return HttpResponse.json(
        ok({
          items: items.slice(0, pageSize),
          nextCursor: null,
          hasMore: false,
        } satisfies CursorResult<ProjectMemberView>),
      );
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/projects/:projectId/invitations', ({ params, request }) => {
    try {
      const projectId = String(params.projectId);
      const url = new URL(request.url);
      const status = url.searchParams.get('status') ?? undefined;
      const email = url.searchParams.get('email') ?? undefined;
      let items = invitations.filter((i) => i.projectId === projectId);
      if (status) items = items.filter((i) => i.status === status);
      if (email) {
        const q = email.toLowerCase();
        items = items.filter((i) => i.inviteeEmail?.toLowerCase().includes(q));
      }
      return HttpResponse.json(
        ok({
          items,
          nextCursor: null,
          hasMore: false,
        } satisfies CursorResult<InvitationView>),
      );
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/invitations', async ({ params, request }) => {
    try {
      const projectId = String(params.projectId);
      const accountId = resolveBearerAccountId(request) ?? seedAccount.accountId;
      const body = (await request.json()) as {
        inviteeEmail?: string;
        inviteeAccountId?: string;
        role?: string;
      };
      const email = body.inviteeEmail?.trim() || null;
      const inviteeAccountId = body.inviteeAccountId?.trim() || null;
      if ((email && inviteeAccountId) || (!email && !inviteeAccountId)) {
        return fail('400', 'Provide inviteeEmail or inviteeAccountId, not both');
      }
      const role = body.role?.trim() || 'DEVELOPER';
      if (role === 'OWNER') {
        return fail('400', 'OWNER cannot be invited; use ownership transfer');
      }
      const duplicate = invitations.find(
        (i) =>
          i.projectId === projectId &&
          i.status === 'PENDING' &&
          ((email && i.inviteeEmail === email) ||
            (inviteeAccountId && i.inviteeAccountId === inviteeAccountId)),
      );
      if (duplicate) {
        return fail('409', 'A PENDING invitation already exists for this target', 409);
      }
      const invitation: InvitationView = {
        invitationId: newId('inv'),
        projectId,
        inviteeEmail: email,
        inviteeAccountId,
        role,
        status: 'PENDING',
        expiresAt: Date.now() + 7 * 86_400_000,
        invitedBy: accountId,
        acceptedAt: null,
        createTime: Date.now(),
      };
      invitations = [invitation, ...invitations];
      return HttpResponse.json(ok(invitation));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/project-invitations/:invitationId/revoke', ({ params }) => {
    try {
      const invitationId = String(params.invitationId);
      const idx = invitations.findIndex((i) => i.invitationId === invitationId);
      if (idx < 0) return fail('404', 'Invitation not found', 404);
      if (invitations[idx].status !== 'PENDING') {
        return fail('409', 'Only PENDING invitations can be revoked', 409);
      }
      invitations[idx] = { ...invitations[idx], status: 'REVOKED' };
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post(
    '/api/v1/project-invitations/:invitationId/accept',
    async ({ params, request }) => {
      try {
        const invitationId = String(params.invitationId);
        const accountId = resolveBearerAccountId(request) ?? seedAccount.accountId;
        const body = (await request.json()) as { token?: string };
        if (!body?.token?.trim()) {
          return fail('400', 'token is required');
        }
        const idx = invitations.findIndex((i) => i.invitationId === invitationId);
        if (idx < 0) return fail('404', 'Invitation not found', 404);
        const invitation = invitations[idx];
        if (invitation.status !== 'PENDING') {
          return fail('409', 'Invitation is not pending', 409);
        }
        const account = accounts.find((a) => a.accountId === accountId) ?? seedAccount;
        const member: ProjectMemberView = {
          projectId: invitation.projectId,
          accountId: account.accountId,
          username: account.username,
          email: account.email,
          role: invitation.role,
          membershipStatus: 'ACTIVE',
          joinedAt: Date.now(),
          createTime: Date.now(),
          updateTime: Date.now(),
        };
        members = [...members.filter((m) => !(m.projectId === member.projectId && m.accountId === member.accountId)), member];
        invitations[idx] = {
          ...invitation,
          status: 'ACCEPTED',
          acceptedAt: Date.now(),
          inviteeAccountId: account.accountId,
        };
        return HttpResponse.json(
          ok({ invitation: invitations[idx], member }),
        );
      } catch {
        return fail('500', 'Internal server error', 500);
      }
    },
  ),

  http.get('/api/v1/projects/:projectId/authorization', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const authz = authorizations.find((a) => a.projectId === projectId);
      if (!authz) return fail('404', 'Authorization not found', 404);
      return HttpResponse.json(ok(authz));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.get('/api/v1/projects/:projectId/authorization/key-pair', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const authz = authorizations.find((a) => a.projectId === projectId);
      if (!authz) return fail('404', 'Authorization not found', 404);
      if (authz.status === 'REVOKED') {
        return fail('409', 'Revoked authorization has no active key pair', 409);
      }
      const keyPair = keyPairs.find((k) => k.projectId === projectId);
      if (!keyPair) return fail('404', 'Key pair not found', 404);
      return HttpResponse.json(ok(keyPair));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/authorization/rotate', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const authIdx = authorizations.findIndex((a) => a.projectId === projectId);
      if (authIdx < 0) return fail('404', 'Authorization not found', 404);
      const keyPair: ProjectKeyPairView = {
        projectId,
        clientId: newId('cli'),
        clientSecret: newId('sec'),
      };
      keyPairs = [
        ...keyPairs.filter((k) => k.projectId !== projectId),
        keyPair,
      ];
      authorizations[authIdx] = {
        ...authorizations[authIdx],
        status: 'ACTIVE',
        lastRotatedAt: Date.now(),
      };
      return HttpResponse.json(ok(keyPair));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/authorization/enable', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const idx = authorizations.findIndex((a) => a.projectId === projectId);
      if (idx < 0) return fail('404', 'Authorization not found', 404);
      if (authorizations[idx].status === 'REVOKED') {
        return fail('409', 'REVOKED cannot be enabled; rotate instead', 409);
      }
      authorizations[idx] = { ...authorizations[idx], status: 'ACTIVE' };
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/authorization/disable', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const idx = authorizations.findIndex((a) => a.projectId === projectId);
      if (idx < 0) return fail('404', 'Authorization not found', 404);
      if (authorizations[idx].status === 'REVOKED') {
        return fail('409', 'REVOKED cannot be disabled', 409);
      }
      authorizations[idx] = { ...authorizations[idx], status: 'DISABLED' };
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.post('/api/v1/projects/:projectId/authorization/revoke', ({ params }) => {
    try {
      const projectId = String(params.projectId);
      const idx = authorizations.findIndex((a) => a.projectId === projectId);
      if (idx < 0) return fail('404', 'Authorization not found', 404);
      authorizations[idx] = { ...authorizations[idx], status: 'REVOKED' };
      return HttpResponse.json(ok(true));
    } catch {
      return fail('500', 'Internal server error', 500);
    }
  }),

  http.put(
    '/api/v1/projects/:projectId/authorization/network-policy',
    async ({ params, request }) => {
      try {
        const projectId = String(params.projectId);
        const idx = authorizations.findIndex((a) => a.projectId === projectId);
        if (idx < 0) return fail('404', 'Authorization not found', 404);
        const body = (await request.json()) as {
          networkPolicyEnabled?: boolean;
          ipAllowlist?: string[];
        };
        authorizations[idx] = {
          ...authorizations[idx],
          networkPolicyEnabled: Boolean(body.networkPolicyEnabled),
          ipAllowlist: Array.isArray(body.ipAllowlist) ? body.ipAllowlist : [],
        };
        return HttpResponse.json(ok(authorizations[idx]));
      } catch {
        return fail('500', 'Internal server error', 500);
      }
    },
  ),
];

/** Seed snapshots for later tasks (members / invitations / authz handlers). */
export const openPlatformSeed = {
  accounts: () => accounts.map(toAccountView),
  projects: () => projects,
  members: () => members,
  invitations: () => invitations,
  authorizations: () => authorizations,
  keyPairs: () => keyPairs,
  categories: () => categories,
  products: () => products,
};
