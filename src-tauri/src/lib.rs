#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_opener::init());

    // 测试专用：在应用进程内起一个 W3C WebDriver HTTP server。
    // 只在 debug 构建存在——release 包绝不能带可被远程驱动的服务。
    // tauri_plugin_wdio 提供 browser.tauri.*（execute/mock/窗口状态）所需命令；
    // 没有它，@wdio/tauri-service 每条命令都会在 5s core.invoke 超时上空转。
    #[cfg(debug_assertions)]
    let builder = builder
        .plugin(tauri_plugin_wdio_webdriver::init())
        .plugin(tauri_plugin_wdio::init());

    builder
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
