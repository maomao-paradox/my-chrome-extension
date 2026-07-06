/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/types/api/index.ts
 * @date 2026-02-05T02:38:01.697Z
 */

export interface Response<T = any> {
  msg?: string;
  message?: string;
  code: number;
  data: T;
}


/**
 * 用户信息接口定义
 */
export interface UserInfo {
  nickname: string;
  realname: string;
  password: string;
  role_code: string;
  user_type_ids: string;
  dept_dict_code: string;
  dept_dict_name: string;
  username?: string;
  role_name?: string;
  phone?: string;
  gender?: string;
  group_codes?: number[];
  email?: string;
  wx_id?: string;
  remarks?: string;
  user_code?: string;
  department_ward?: string;
  head_img?: string;
  job?: string;
  updated_at?: string;
  job_detail?: string;
  groups?: string;
  is_active?: string;
}

// 患者注册数据接口
export type PatientRegistrationData = {
  admission_number: string
  name: string | null
  gender: string
  id_number: string
  age: number
  phone: string
  birthdate: string
  marital_status: string
  patient_type: string
  contact_number: string
  payment_way: string | string[]
  docGroup: string | null
  social_security_card_no: string
  patient_id: string
  visit_number: string
  visit_sn: string
  visit_times: number
  hospitalization_times: number
  allergic_history: string
  past_medical_history: string
}

// 定义接口
export interface SessionInfo {
  realname?: string;
  user_code?: string;
  hospital_code?: string;
}

export interface RequestHeaders {
  [key: string]: string;
}

export interface RequestBody {
  [key: string]: any;
}

export interface ApiResponse {
  data?: any;
  msg?: string;
  code?: number;
}

// 消息类型定义
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export interface MCPToolConfig {
  name: string;
  description: string;
  inputSchema?: {
    type: string;
    properties: Record<string, any>;
    required: string[];
  };
  product?: string;
}

export interface MCPTool {
  config: MCPToolConfig;
  execute?: (args: any) => Promise<any>;
}