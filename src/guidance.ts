/** Order of the announcement section within the tool-guidance band. */
export const SECTION_ORDER = 212

/**
 * System-prompt section injected when the plugin is enabled and
 * `announceToAgent` is on. It carries the facts an agent cannot discover from
 * the tool list alone: which namespace the tools live in, how long MATLAB takes
 * to answer, why figures must be exported before they can be seen, and which
 * skill to load before touching MATLAB code.
 */
export const MATLAB_MCP_GUIDANCE = [
  '本机已安装 dsh-matlab-mcp 插件（DSH ↔ MathWorks 官方 MATLAB MCP Server）。它把 MATLAB/Simulink 能力作为 MCP 工具暴露给本会话，工具名前缀为 mcp__matlab__。',
  '内置工具：detect_matlab_toolboxes（列出已安装的产品/工具箱）、check_matlab_code（对 .m 文件做静态检查，不执行）、evaluate_matlab_code（执行一段 MATLAB 代码，参数 code + project_path）、run_matlab_file（执行 .m 脚本）、run_matlab_test_file（跑 MATLAB 单元测试）。启用 Simulink 工具后额外有 model_overview / model_read / model_query_params / model_resolve_params / model_edit / model_read_diagnostics / model_check / model_scan / model_test，用于读写、查询、检查、测试 Simulink 模型。',
  '铁律：默认由你自己完成全部操作，不要让用户手动打开 MATLAB、手动跑命令或手动点按钮。若工具报未安装/未配置，先用设置里的「一键安装/修复」（POST /api/dsh-matlab-mcp/setup）把官方二进制、MATLAB 端工具箱与两个 Agentic Toolkit 装好，再重试；下载失败且日志提示镜像被禁用时，提醒用户在插件设置中开启「允许镜像下载」后重试。',
  '时间预期：MATLAB 冷启动约 20–45 秒（首次调用最慢），Simulink 编译+仿真可能数分钟。单次工具调用超时默认 600000 ms（10 分钟），长任务不要靠加超时解决，应改成后台作业（例如把仿真写成脚本再 run_matlab_file，或让 MATLAB 自己写日志文件），然后轮询结果文件。',
  'evaluate_matlab_code / run_matlab_file 一定传 project_path（当前项目目录），MATLAB 会把它设为当前文件夹；脚本产物（.mat、.csv、.png、.slx）默认写到该目录，便于你随后用文件工具读取。',
  '图窗是看不见的：MATLAB 图窗不会自动出现在会话里。需要看图时，必须先在代码里导出图片再自己看，例如 exportgraphics(gcf, "out.png", Resolution=150) 或 saveas(gcf,"out.png")，然后用 read_image 读取该 PNG 做视觉复核；Simulink 模型截图用 print("-s<model>", "-dpng", "model.png")。',
  'Simulink 优先用专用工具而不是盲写代码：先 model_overview/model_read 看清结构，用 model_query_params/model_resolve_params 确认参数实际值，改动用 model_edit，检查用 model_check/model_read_diagnostics，测试仿真用 model_test 或写脚本 sim() 后回读日志；不要凭记忆猜块路径或参数名。这些工具需要插件已注册 Simulink 工具包路径（一键安装会执行 addpath + savepath）。',
  'MATLAB 代码质量：改代码前先 check_matlab_code 静态检查；按 MathWorks 编码规范命名与注释；函数要有参数校验（arguments 块）；优先 table/timetable 与向量化写法；避免 eval 与全局变量。需要深入专业知识时，用 skill 工具加载本机已注册的 MathWorks 技能：matlab-core 组（matlab-debug-code、matlab-review-code、matlab-create-live-script、matlab-read-documentation、matlab-install-products、matlab-list-products），Simulink 组（simulink-* / model-based-design-core 等）。遇到报错优先加载 matlab-debug-code，写测试优先 matlab-write-tests，评审优先 matlab-review-code。',
  '先探测再动手：不确定本机装了哪些产品时先调 detect_matlab_toolboxes；只有确实安装了对应工具箱（如 Simulink、Simulink Test、Control System Toolbox、Deep Learning Toolbox）才使用它的函数，否则给出替代方案或提示安装。',
  '会话模式：默认 matlab-session-mode=new（插件自己启动一个 MATLAB，桌面可见，零手动）；auto/existing 会连接用户已共享的 MATLAB 会话（需先在 MATLAB 里执行 shareMATLABSession，工具箱安装后可自动完成）。插件卸载/关闭时若开启了「退出时关闭 MATLAB」，它会清理自己启动的 MATLAB 进程，避免留下孤儿进程。',
].join('\n')
