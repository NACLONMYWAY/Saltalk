import type { ExamSystem } from './types.ts'

export interface TopicCategory {
  category: string
  topics: string[]
}

/** CEFR / 雅思通用：日常生活场景，偏口语化 */
export const TOPIC_LIBRARY: TopicCategory[] = [
  {
    category: '日常',
    topics: ['点咖啡', '问路', '超市购物', '约朋友吃饭', '聊天气', '银行办事', '药店买药', '理发', '寄快递', '修手机']
  },
  {
    category: '旅行',
    topics: ['机场值机', '酒店入住', '打车', '景点买票', '迷路求助', '租车', '退房', '机场安检', '换外币', '订餐厅']
  },
  {
    category: '职场',
    topics: ['面试', '开会发言', '请假', '跟同事吃饭', '电话沟通', '谈加薪', '汇报工作', '团建', '辞职', '远程会议']
  },
  {
    category: '餐饮',
    topics: ['餐厅点餐', '结账', '抱怨食物', '问招牌菜', '订位', '点外卖', '咖啡厅闲聊']
  },
  {
    category: '购物',
    topics: ['买衣服', '退换货', '砍价', '问尺码', '网购咨询', '买电子产品', '商场找店铺']
  },
  {
    category: '健康',
    topics: ['看医生', '预约挂号', '描述症状', '买药', '看牙医', '体检', '药店咨询']
  },
  {
    category: '社交',
    topics: ['初次见面', '介绍朋友', '道歉', '表达感谢', '邀请参加聚会', '聊近况', '告别']
  },
  {
    category: '兴趣',
    topics: ['聊电影', '聊音乐', '聊运动', '推荐餐厅', '周末计划', '聊读书', '聊游戏', '聊摄影', '聊烹饪', '聊旅行经历']
  },
  {
    category: '学习',
    topics: ['问作业', '图书馆借书', '报名课程', '考试咨询', '请教问题', '选专业', '聊学习方法']
  },
  {
    category: '应急',
    topics: ['报警求助', '失物招领', '证件丢失', '车辆故障', '就医急诊', '航班延误']
  }
]

/**
 * 四六级专用主题。
 *
 * 四六级听力长对话的场景是「校园事务 / 求职职场 / 真实生活服务 / 社会议题」，
 * 说话人在讨论具体事务、交换观点与因果，而不是点单寒暄。
 * 沿用 CEFR 的日常题库（点咖啡、问路）会把难度拉低一大截。
 */
export const CET_TOPIC_LIBRARY: TopicCategory[] = [
  {
    category: '校园学习',
    topics: [
      '选课与退课',
      '学分与毕业要求',
      '论文选题与导师沟通',
      '小组作业分工',
      '图书馆资料检索',
      '期末复习计划',
      '交换生项目面试',
      '奖学金申请材料',
      '实验数据出错',
      '课堂展示准备'
    ]
  },
  {
    category: '求职职场',
    topics: [
      '实习面试',
      '简历修改建议',
      '薪资与福利谈判',
      '入职培训安排',
      '项目进度汇报',
      '跨部门协作分歧',
      '客户投诉处理',
      '远程办公安排',
      '职业转型咨询',
      '年度绩效评估'
    ]
  },
  {
    category: '生活事务',
    topics: [
      '租房看房与押金',
      '房屋维修报修',
      '宽带与手机套餐',
      '银行账户与手续费',
      '医疗保险理赔',
      '搬家与物流',
      '驾照换证',
      '快递丢失索赔',
      '健身房会员退订',
      '机票改签'
    ]
  },
  {
    category: '社会与科技',
    topics: [
      '城市公共交通规划',
      '垃圾分类政策',
      '社交媒体与青少年',
      '人工智能对就业的影响',
      '远程教育与线下课堂',
      '共享经济',
      '久坐与健康作息',
      '新能源与环保',
      '人口老龄化',
      '消费主义与极简生活'
    ]
  }
]

/**
 * 雅思专用主题。
 * Section 1/2 偏生活事务（租房、报名、预约），Section 3 偏学术讨论（小组作业、导师辅导）。
 */
export const IELTS_TOPIC_LIBRARY: TopicCategory[] = [
  {
    category: '生活事务',
    topics: [
      '租房咨询',
      '课程报名',
      '酒店预订',
      '机场接送预约',
      '健身房办卡',
      '医疗预约',
      '旅游团咨询',
      '宠物寄养',
      '社区活动报名',
      '二手家具交易'
    ]
  },
  {
    category: '学术讨论',
    topics: [
      '小组作业分工',
      '论文选题讨论',
      '实验方案调整',
      '文献综述',
      '数据收集方法',
      '导师反馈',
      '演讲排练',
      '实习报告',
      '课程选择',
      '研究方法比较'
    ]
  }
]

export const SYSTEM_TOPICS: Record<ExamSystem, TopicCategory[]> = {
  cefr: TOPIC_LIBRARY,
  ielts: IELTS_TOPIC_LIBRARY,
  cet: CET_TOPIC_LIBRARY
}

/** 返回指定体系的全部主题（扁平化）。不传参数时为 CEFR 题库。 */
export function allTopics(system: ExamSystem = 'cefr'): string[] {
  return (SYSTEM_TOPICS[system] ?? TOPIC_LIBRARY).flatMap((c) => c.topics)
}

/** 随机选取一个主题。可注入随机数生成器便于测试。 */
export function randomTopic(system: ExamSystem = 'cefr', rng: () => number = Math.random): string {
  const topics = allTopics(system)
  if (topics.length === 0) {
    throw new Error('主题库为空')
  }
  const idx = Math.floor(rng() * topics.length)
  // 防御 rng 越界（负数或 >=1）的情况
  return topics[Math.max(0, Math.min(idx, topics.length - 1))]
}
