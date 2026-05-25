<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

$appRoot = '__APP_ROOT__';

if (!is_dir($appRoot)) {
    http_response_code(500);
    echo 'Application root not found. Check deploy/cpanel/public_html_index.php path.';
    exit;
}

if (file_exists($maintenance = $appRoot . '/storage/framework/maintenance.php')) {
    require $maintenance;
}

require $appRoot . '/vendor/autoload.php';

(require_once $appRoot . '/bootstrap/app.php')
    ->handleRequest(Request::capture());
