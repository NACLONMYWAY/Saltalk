export interface TopicCategory {
  category: string
  topics: string[]
}

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

/** 返回全部主题（扁平化） */
export function allTopics(): string[] {
  return TOPIC_LIBRARY.flatMap((c) => c.topics)
}

/** 随机选取一个主题。可注入随机数生成器便于测试。 */
export function randomTopic(rng: () => number = Math.random): string {
  const topics = allTopics()
  if (topics.length === 0) {
    throw new Error('主题库为空')
  }
  const idx = Math.floor(rng() * topics.length)
  // 防御 rng 越界（负数或 >=1）的情况
  return topics[Math.max(0, Math.min(idx, topics.length - 1))]
}
