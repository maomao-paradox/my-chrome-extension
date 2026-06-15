/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/api/mria-api.ts
 * @date 2026-02-05T02:38:01.687Z
 */

import { randomSelect, getQueryParams, getFirstClipboard } from '@/utils/base';
import { saveToLocal } from '@/utils/element-control';
import { storage } from '@/stores';
import { SessionInfo, RequestHeaders, RequestBody, UserInfo } from '@/assets/types';

// 获取token
export function get_token(): string | null {
  const parts = /Manteia-token=(.*);?/.exec(document.cookie);
  if (parts && parts.length > 1) {
    return parts[1].trim();
  } else {
    maLogger.log("获取token失败，请检查是否登录或token是否过期");
    return null;
  }
}

// 请求类
export class Requester {
  access_token: string | null;
  defaultHeaders: RequestHeaders;
  action_client_code: string;
  action_user_name: string;
  action_user_code: string;
  hospital_code: string;

  constructor(token?: string | null) {
    this.access_token = token || get_token();
    this.defaultHeaders = {
      "accept": "application/json, text/plain, */*",
      "accept-language": "zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7",
      "content-type": "application/json;charset=UTF-8",
      "priority": "u=1, i",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-origin",
      "x-requested-with": "1729565845731"
    };
    this.action_client_code = "PC";

    let contentStorage: SessionInfo = {};
    try {
      contentStorage = storage.page.local.get('Manteia-UserInfo', {}) as SessionInfo;
    } catch (e) {
      maLogger.log('Manteia-UserInfo 获取失败', e);
    }

    this.action_user_name = contentStorage.realname || "mpadmin";
    this.action_user_code = contentStorage.user_code || "USER2020042101";
    this.hospital_code = contentStorage.hospital_code || "HOSPITSDZL0018465465";
  }

  restruct(): void {
    this.access_token = get_token();
    try {
      const contentStorage: SessionInfo = storage.page.local.get('Manteia-UserInfo', {}) as SessionInfo;
      this.action_user_name = contentStorage.realname || '';
      this.action_user_code = contentStorage.user_code || '';
      this.hospital_code = contentStorage.hospital_code || "HOSPITSDZL0018465465";
    } catch (e) {
      maLogger.log("重新获取用户信息失败", e);
      this.action_user_name = "";
      this.action_user_code = "";
    }
  }

  async mpost(url: string, data?: RequestBody | string, headers?: RequestHeaders): Promise<any> {
    try {
      const default_headers = { ...this.defaultHeaders, ...(headers || {}) };
      const default_body = {
        ...(typeof data === 'string' ? JSON.parse(data) : data || {}),
        action_user_name: this.action_user_name,
        action_user_code: this.action_user_code,
        action_client_code: this.action_client_code,
        hospital_code: this.hospital_code,
        access_token: this.access_token
      };

      return await fetch(url, {
        method: 'POST',
        headers: default_headers,
        body: JSON.stringify(default_body),
        redirect: 'follow'
      }).then(res => res.json());
    } catch (error) {
      maLogger.log(error);
      throw error;
    }
  }

  async mpost_file(url: string, data?: RequestBody | null, file?: File, headers?: RequestHeaders): Promise<any> {
    try {
      const default_headers = {
        ...(headers || {}),
        "accept": "*/*",
        "Connection": "keep-alive"
      };

      const default_form = new FormData();
      default_form.append("action_user_name", this.action_user_name || "");
      default_form.append("action_user_code", this.action_user_code || "");
      default_form.append("action_client_code", this.action_client_code || "");
      default_form.append("hospital_code", this.hospital_code || "");
      default_form.append("access_token", this.access_token || "");

      if (data) {
        for (const key in data) {
          if (Object.prototype.hasOwnProperty.call(data, key)) {
            default_form.append(key, data[key]);
          }
        }
      }

      if (file && file.size > 0) {
        default_form.append("file", file);
      }

      return await fetch(url, {
        method: 'POST',
        headers: default_headers,
        body: default_form,
        redirect: 'follow'
      }).then(res => res.json());
    } catch (error) {
      maLogger.log(error);
      throw error;
    }
  }

  async mget(base_url: string, params?: RequestBody, headers?: RequestHeaders): Promise<Response> {
    try {
      const default_headers = {
        ...this.defaultHeaders,
        ...(headers || {}),
        "Cookie": `Manteia-token=${this.access_token}`,
        "accept": "*/*"
      };

      const convertObjectToQueryString = (obj: RequestBody): string => {
        const search_params = new URLSearchParams();
        for (const key in obj) {
          if (Object.prototype.hasOwnProperty.call(obj, key)) {
            search_params.append(key, obj[key]);
          }
        }
        return search_params.toString();
      };

      const queryString = params && typeof params === "object" ? convertObjectToQueryString(params) : "";
      const url = queryString ? `${base_url}?${queryString}` : base_url;

      return await fetch(url, {
        headers: default_headers,
        referrerPolicy: "strict-origin-when-cross-origin",
        method: "GET"
      });
    } catch (error) {
      maLogger.log(error);
      throw error;
    }
  }
}

// 搜索流程
export async function searchFlow(this: Requester, name?: string): Promise<string | null> {
  const res = await this.mpost('/api/query_flow', {
    "query_word": name || "",
    "page": 1,
    "page_size": 20,
    "menu_code": "FlowSettingManage"
  }).then((res: any) => res.data?.data || []);

  if (res.length > 0) {
    for (let item of res) {
      if (item.name === name) return item.code;
    }
    return res[0].code;
  } else {
    maLogger.log("获取流程列表为空");
    return null;
  }
}

// 重新加载远程设备
export async function reloadRemoteDevices(this: Requester): Promise<void> {
  try {
    const guac_token = await this.mpost('/api/get_remote_guac_token').then((res: any) => res.data?.guac_token);
    const device_list = await this.mpost('/api/get_remote_device_list', {
      "page": 1,
      "page_size": 999,
      "guac_token": await guac_token
    }).then((res: any) => res.data?.data || []);

    if (device_list && device_list.length > 0) {
      for (let item of device_list) {
        let device_name = item.name;
        await this.mpost('/api/delete_remote_device', {
          "device_code": item.device_code,
          "guac_token": await guac_token
        }).then((res: any) => maLogger.log(`删除${device_name}：${res.msg}`));
        item.guac_token = await guac_token;
        await this.mpost('/api/add_remote_device', item).then((res: any) => maLogger.log(`重新添加${device_name}：${res.msg}`));
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    } else {
      maLogger.log("获取远程控制列表失败");
    }
  } catch (error) {
    maLogger.log(error);
  }
}

// 获取用户列表
export async function getUserList(this: Requester, type_id?: number): Promise<any[]> {
  return await this.mpost('/api/get_user_list_by_user_type', {
    "user_type_id": type_id || 1 << 1,
    "menu_code": ""
  }).then((res: any) => res.data || []);
}

// 搜索表单
export async function searchForm(this: Requester, name?: string): Promise<any[]> {
  return await this.mpost('/api/search_form', {
    "name": name || "",
    "filter_code_list": [],
    "page": 1,
    "page_size": 999
  }).then((res: any) => res.data?.data || []);
}

// 获取就诊信息
export async function getVisitInfo(this: Requester, pd: string): Promise<any> {
  return await this.mpost("/mriaapi/get_visit_info", {
    "patient_visit_code": pd
  }).then((res: any) => res.data);
}

// 更新患者图片
export async function updatePatientImage(this: Requester, id_number: string, patient_code: string, img_file: File): Promise<any> {
  try {
    if (!img_file.size) throw new Error("文件大小为0");
    if (img_file.size > 5 * 1024 * 1024) throw new Error("文件大小超过5MB");
    if (!id_number || !patient_code) throw new Error("未获取到患者信息");

    return await this.mpost_file("/mriaapi/update_patient_image", {
      "id_number": id_number,
      "patient_visit_code": patient_code
    }, img_file);
  } catch (error) {
    maLogger.log(error);
    throw error;
  }
}

// 上传签名图片
export async function uploadSignPicture(this: Requester, img_file: File): Promise<any> {
  try {
    if (!(img_file instanceof File)) {
      throw new Error("文件格式错误");
    }

    const form_data = new FormData();
    form_data.append("patient_code", undefined as any);
    form_data.append("identifier", "123");

    return await this.mpost_file("/api/upload_file", form_data, img_file);
  } catch (error) {
    maLogger.log(error);
    throw error;
  }
}

// 下载表格
export async function downloadSheet(this: Requester, form_code: string, sheet_component_code: string): Promise<void> {
  try {
    let items = await this.mpost("/api/search_sheet_template", {
      "form_code": form_code,
      "name": "",
      "sheet_component_code": sheet_component_code
    }).then((res: any) => res['data']?.[0]?.['children'] || []);

    for (const item of items) {
      try {
        maLogger.log(item);
        let name = item['sheet_name'];
        let params = {
          "sheet_template_code": item['sheet_template_code'],
          "form_code": name
        };
        let response = await this.mget("/api/download_sheet_template", params, {
          "sec-fetch-dest": "document",
          "sec-fetch-mode": "navigate",
          "sec-fetch-site": "none"
        });
        let result = await response.blob();
        saveToLocal(result, `${name}.xlsx`);
        maLogger.log(`文件下载成功: ${name}.xlsx`);
      } catch (error) {
        maLogger.log(`文件下载出错: ${item['sheet_name']}`, error);
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  } catch (error) {
    maLogger.log(error);
    throw error;
  }
}

// 下载表格模板
export async function downloadSheetTemplate(this: Requester, component_name: string): Promise<void> {
  try {
    const params = getQueryParams();
    const form_code = params['code'] as string;
    const components = await this.mpost("/api/form_template_design", {
      "form_code": form_code
    }).then((res: any) => res.data["components"] || []);
    const component_code = await findComponentCodeByName(components, component_name);

    if (component_code) {
      await downloadSheet.call(this, form_code, component_code);
    } else {
      maLogger.log(`获取组件code失败:${component_code}`);
    }
  } catch (error) {
    maLogger.log(error);
    throw error;
  }
}

// 通过名称获取表单代码
export async function getFormCodeByName(this: Requester, form_name: string): Promise<string | null> {
  const res = await this.mpost('/api/search_form', {
    "name": form_name || "",
    "filter_code_list": [],
    "page": 1,
    "page_size": 999,
  }).then((res: any) => res.data?.data || []);

  if (res.length > 0) {
    for (let item of res) {
      if (item.name === form_name) return item.code;
    }
    return res[0].code;
  } else {
    maLogger.error("无法检索到相关表单：", form_name);
    return null;
  }
}

// 获取医疗科室列表
export async function getMedicalDepartmentList(this: Requester): Promise<any[]> {
  return await this.mpost('/api/get_medical_department_list')
    .then((res: any) => res.data?.data || []);
}

// 添加表单
export async function addForm(this: Requester, form_name: string): Promise<any> {
  const dept_list = await getMedicalDepartmentList.call(this);
  const dept_code = dept_list.length > 0 ? dept_list.map((dp: any) => dp.dept_code) : [];

  return await this.mpost('/api/add_form', {
    "name": form_name,
    "remark": "",
    "is_patient_consent": false,
    "dept_code": await dept_code,
    "dept_name": [],
    "is_print_footer": true
  });
}

// 更新表单
export async function updateForm(this: Requester, form_code: string, form_name: string, components: any[]): Promise<any> {
  return await this.mpost('/api/form_template_save', {
    "form_template_dict": {
      "form_code": form_code,
      "form_name": form_name,
      "components": components
    }
  });
}

// 自动延迟
export async function autoDelay(this: Requester): Promise<any> {
  return await this.mpost(`/mriaapi/patient_apply_auto_delay`);
}

// 自动检查超时任务
export async function autoCheckTimeoutTask(this: Requester): Promise<any> {
  return await this.mpost(`/mriaapi/auto_check_timeout_task`);
}

// 获取表单设计
export async function getFormDesign(this: Requester, form_code: string): Promise<any[]> {
  return await this.mpost('/api/form_template_design', {
    "form_code": form_code
  }).then((res: any) => res.data?.components || []);
}

// 标记高危
export async function markHighRisk(this: Requester, patient_visit_code: string, treat_flow_code: string): Promise<any> {
  try {
    const patient_inspect_info = await this.mpost('/mriaapi/get_patient_inspect_info', {
      "patient_visit_code": patient_visit_code,
      "treat_flow_code": treat_flow_code,
      "is_inspect": 1
    }).then((res: any) => {
      return {
        ...res.data,
        "is_high_risk": true,
        "remarks": "由系统自动生成"
      };
    });

    const node_code = await this.mpost('/mriaapi/get_patient_treatflow_flownode', {
      "treatflow_code": treat_flow_code
    }).then((res: any) => res.data?.cur_node_code);

    return this.mpost('/mriaapi/update_patient_inspect_info', {
      "patient_visit_code": patient_visit_code,
      "treat_flow_code": treat_flow_code,
      "operation_node": await node_code,
      "patient_inspect_info": await patient_inspect_info,
      "commit_user_code": "USER2020042101",
      "commit_user_name": "mpadmin",
    });
  } catch (error) {
    maLogger.log(error);
    throw error;
  }
}

// 获取诊断
export async function getDiagnosis(this: Requester): Promise<any[]> {
  return await this.mpost(`/mriaapi/get_diagnosis_value_template`, {
    "diagnosis_type": "tumor_diagnosis"
  }).then((res: any) => res.data || []);
}

// 上传患者图片
export async function uploadPatientImage(this: Requester, image: File): Promise<string> {
  return await this.mpost_file(`/mriaapi/upload_patient_image`, null, image)
    .then((res: any) => res.data?.file_id || '');
}

// 注册患者
export async function registerPatient(this: Requester, data: any, head_img?: File): Promise<any> {
  try {
    const form_code = await getFormCodeByName.call(this, '^基本信息$') || "FORMXXdzcf0y1CsSmiqTbr1655088868";
    const patient_name = await getFirstClipboard();
    const doctorList = await getUserList.call(this, 1 << 1);

    const form_data = {
      ...data,
      "name": patient_name ? patient_name.length > 1 << 5 ? patient_name.substring(1 >> 1, 1 << 5) : patient_name : "测试患者",
      "docGroup": doctorList && doctorList.length > 1 >> 1 ? [(randomSelect(doctorList) as any).user_code] : null
    };

    const components = await getFormDesign.call(this, form_code)
      .then((cs: any[]) => writeForm(cs, form_data));

    const head_img_url = head_img ? await uploadPatientImage.call(this, head_img) : '';

    return await this.mpost(`/mriaapi/add_visit_info`, {
      "face_id": "",
      "head_img": head_img_url,
      "form_template": {
        "form_code": await form_code,
        "components": await components,
        "version": 0
      },
      "register_code": "",
    });
  } catch (error) {
    maLogger.log(error);
    throw error;
  }
}

// 删除患者
export async function deletePatient(this: Requester, patient_visit_code: string): Promise<any> {
  return await this.mpost("/mriaapi/delete_patient_visit", {
    "patient_name": "0个",
    "patient_visit_code": patient_visit_code,
  });
}


export async function addUser(this: Requester, userInfo: UserInfo): Promise<any> {
  // 从用户信息对象中提取必要字段
  const {
    nickname,
    realname,
    password,
    role_code,
    user_type_ids,
    dept_dict_code,
    dept_dict_name,
    // 可选字段，使用默认值或传入的值
    username = "",
    role_name = "",
    phone = "",
    gender = "",
    group_codes = [],
    email = "",
    wx_id = "",
    remarks = "",
    user_code = "",
    department_ward = "",
    head_img = "",
    job = "",
    updated_at = "",
    job_detail = "",
    groups = "",
    is_active = ""
  } = userInfo;

  return await this.mpost("/api/add_user", {
    username,
    nickname,
    password,
    realname,
    role_code,
    role_name,
    phone,
    gender,
    group_codes,
    email,
    wx_id,
    remarks,
    user_code,
    department_ward,
    head_img,
    job,
    dept_dict_code,
    user_type_ids: user_type_ids.split("").map(Number),
    dept_dict_name,
    updated_at,
    job_detail,
    groups,
    is_active
  });
}

// 创建治疗流程
export async function createTreatflow(this: Requester, patient_visit_code: string): Promise<any> {
  try {
    const flow_code = await searchFlow.call(this, '通用流程')
      || await searchFlow.call(this, '完整流程')
      || await searchFlow.call(this, '外照射流程');

    const diagnoses = randomSelect(await getDiagnosis.call(this).then((res: any[]) => res.map(d => d.value)));

    const data = {
      "treatment_area": [["头颈部", "鼻咽"]],
      "sick_type_code": "原发",
      "flow_code": await flow_code,
      "treat_aim": "根治",
      "reason": "首程治疗",
      "diagnoses": await diagnoses,
      "tnm_component": {},
      "combine_stage": "",
      "stage_accord": "",
      "remarks": "自动化测试数据"
    };

    const form_code = await getFormCodeByName.call(this, '^程.?段信息$') || "FORMXXmXLKBd2CEekac6vr1670919850";
    const components = await getFormDesign.call(this, form_code)
      .then((cs: any[]) => writeForm(cs, data));

    return await this.mpost(`/mriaapi/save_treatflow_info`, {
      "patient_visit_code": patient_visit_code,
      "is_send": 0,
      "form_template": {
        "form_code": form_code,
        "form_name": "程/段信息",
        "is_must": true,
        "components": components,
        "version": 130,
        "is_has_template": false
      },
    });
  } catch (error) {
    maLogger.log(error);
    throw error;
  }
}

// 用户登录
export async function userLogin(username: string, password: string): Promise<any> {
  //@ts-ignore
  return await (this || new Requester()).mpost("/api/login", {
    "username": username,
    "password": password || (username === 'mpadmin' ? "admin123" : "123456")
  });
}

// 确保函数名称正确
Object.defineProperty(userLogin, "name", {
  value: "userLogin",
  writable: false,
  enumerable: false,
  configurable: true
});

// 用户登出
export async function userLogout(this: Requester): Promise<void> {
  await this.mpost("/api/logout");
}

// 根据名称查找组件代码
export function findComponentCodeByName(components: any[], componentTypeName: string): string | null {
  function searchComponent(component: any): string | null {
    if (component.component_type_name === componentTypeName && component.name === document.body.querySelector(
      "div.active > div > div > span ")?.innerHTML) {
      return component.code;
    }
    if (component.children && component.children.length > 0) {
      for (let child of component.children) {
        let code = searchComponent(child);
        if (code) return code;
      }
    }
    return null;
  }

  try {
    for (let component of components) {
      let code = searchComponent(component);
      if (code) return code;
    }
    return null;
  } catch (error:any) {
    throw new Error(`获取组件code失败:${error.message}`);
  }
}

// 写入表单数据
export function writeForm(components: any[], formData: any, attribute: string = "value"): any[] {
  let componentsCopy = [...components], formDataCopy = { ...formData };

  function processComponent(component: any, data: any): void {
    if (component && typeof component === 'object') {
      const { code, component_type_code } = component;
      const key = Object.keys(data).includes(code) ? code : component_type_code;

      if (key && data[key] !== undefined) {
        component[attribute] = data[key];
        delete data[key];
      }

      if (component.children && component.children.length > 0) {
        component.children.forEach((child: any) => processComponent(child, data));
      }
    }
  }

  if (componentsCopy && componentsCopy.length > 0) {
    for (const component of componentsCopy) {
      processComponent(component, formDataCopy);
    }
  } else {
    throw new Error("TypeError: components is not iterable.");
  }

  return componentsCopy;
}