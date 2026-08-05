/**
 * @author Zero
 * @version v1.0.0
 * @license MIT
 * @sequence X
 * @file src/patch/xhr-patch/rules/mria.ts
 * @date 2026-02-05T02:38:01.696Z
 */

import { type XhrRulesMap } from "@/types";

export const rules: XhrRulesMap = {
  "/api/get_hospital_list": {
    // 拦截响应数据 - 使用JSON指令格式
    responseRules: [
      {
        type: "setField",
        params: {
          path: "response.data[0].auth_status",
          value: 1,
        },
      },
      {
        type: "setField",
        params: {
          path: "response.data[0].expiration_days",
          value: 7,
        },
      },
    ],
  },
  "/mriaapi/get_user_process_info": {
    responseRules: [
      {
        type: "setField",
        params: {
          path: "response.code",
          value: 10003,
        },
      },
      {
        type: "setField",
        params: {
          path: "response.msg",
          value: "未找到用户工号信息",
        },
      },
    ],
  },
  "/mriaapi/get_his_patient_info": {
    responseRules: [
      {
        type: "setField",
        params: {
          path: "response.code",
          value: 10000,
        },
      },
      {
        type: "setField",
        params: {
          path: "response.msg",
          value: "操作成功",
        },
      },
      {
        type: "setField",
        params: {
          path: "response.data",
          value: {
            patient_his_data: {
              code: "",
              hospital_code: "HOSPITSDZL0018465465",
              doctor_group_code: "",
              doctor_group: {},
              doctor_user_code: "",
              doctor_user: {},
              patient_type: "住院",
              admission_number: "15489641",
              name: "测试患者",
              gender: "男",
              birthdate: "1985-01-04",
              age: "40",
              id_number: "372430197502064851",
              marital_status: "",
              phone: "15953171982",
              contact_name: "小红",
              contact_relationship: "子女",
              contact_number: "15863178556",
              native_place: "浙江省",
              live_place: "浙江省温州市虎牙小区3号楼1单元3102",
              head_img: "",
              payment_way: ["职工医保"],
              hospital_citizen: "",
              allergic_history: "无",
              past_medical_history: "无",
              created_at: "2025-06-04 18:33:48",
              first_doctor: "",
              patient_id: "",
              register_code: "USER2020042101",
              register_name: "超级管理员",
              ss_card_id: "",
              social_security_card_no: "",
              surname_pinyin: "",
              name_pinyin: "",
              first_cn_name: "",
              last_cn_name: "",
              face_id: "",
              patient_height: "185cm",
              patient_weight: "65kg",
            },
          },
        },
      },
    ],
  },
  "/mriaapi/add_visit_info_v2": {
    openRules: [
      {
        type: "replaceUrl",
        params: {
          search: "/mriaapi/add_visit_info_v2",
          value: "/mriaapi/add_visit_info",
        },
      },
    ],
  },
};

export default rules;
