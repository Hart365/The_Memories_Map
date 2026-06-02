<?php
/**
 * Memories Map — Web Installer
 *
 * INSTRUCTIONS:
 *  1. Download the "memories-map-cpanel-with-vendor-*.zip" release.
 *  2. Using cPanel File Manager, upload and extract it to your home directory
 *     (e.g. /home/YOURUSER/memories-map). Do NOT extract into public_html.
 *  3. Upload THIS file (memories-map-installer.php) to your public_html directory.
 *  4. Visit https://your-domain.com/memories-map-installer.php in your browser.
 *  5. Follow the on-screen steps. The installer removes itself when finished.
 *
 * SECURITY: This file grants full server access. Delete it immediately after use.
 */

declare(strict_types=1);

// ─────────────────────────── Bootstrap ───────────────────────────────────────

function readInstallerVersion(): string
{
    $candidates = [
        __DIR__ . '/VERSION',
        __DIR__ . '/../../VERSION',
    ];

    foreach ($candidates as $candidate) {
        if (!is_file($candidate)) {
            continue;
        }

        $version = trim((string) @file_get_contents($candidate));
        if ($version !== '') {
            return $version;
        }
    }

    return '0.0.0';
}

define('INSTALLER_VERSION', readInstallerVersion());

$lockFile = __DIR__ . '/memories-map-installer.lock';
if (file_exists($lockFile)) {
    http_response_code(403);
    renderPage(
        'Already Installed',
        1,
        null,
        '<div class="alert alert-success">
            <strong>Memories Map is already installed.</strong><br>
            The installer is locked. Please delete <code>memories-map-installer.php</code>
            and <code>memories-map-installer.lock</code> from your public_html directory immediately.
         </div>'
    );
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

// Guard: reset session if user manually navigates back to step 1
if (!isset($_POST['step']) && !isset($_SESSION['installer_step'])) {
    $_SESSION['installer_step'] = 1;
    $_SESSION['installer_data'] = [];
}

$requestedStep = filter_input(INPUT_GET, 'step', FILTER_VALIDATE_INT);
if ($_SERVER['REQUEST_METHOD'] === 'GET' && $requestedStep !== false && $requestedStep !== null) {
    if ($requestedStep >= 1 && $requestedStep <= 5) {
        $_SESSION['installer_step'] = $requestedStep;
    }
}

$step   = (int)($_POST['step'] ?? $_SESSION['installer_step'] ?? 1);
$errors = [];
$data   = $_SESSION['installer_data'] ?? [];

// ─────────────────────────── POST handlers ───────────────────────────────────

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    switch ($step) {
        // Step 1 → 2: requirements are display-only; just advance
        case 1:
            $reqOk = checkRequirements()['ok'];
            if ($reqOk) {
                advance(2);
            } else {
                $errors[] = 'Please resolve all requirement errors before continuing.';
            }
            break;

        // Step 2 → 3: validate app path
        case 2:
            $rawPath = rtrim(trim($_POST['app_path'] ?? ''), '/\\');
            $path = resolveApplicationPath($rawPath);
            if (!$path) {
                $errors[] = 'Path not found or not accessible: ' . htmlspecialchars($rawPath);
            } elseif (!hasCriticalVendorFiles($path . '/backend') && !file_exists($path . '/deploy/cpanel/vendor.bundle.zip')) {
                $errors[] = 'The <code>backend/vendor</code> directory is incomplete and no recovery bundle was found. Re-upload and extract the latest <strong>with-vendor</strong> release archive, then confirm that <code>backend/vendor/autoload.php</code>, <code>backend/vendor/symfony/deprecation-contracts/function.php</code>, or <code>deploy/cpanel/vendor.bundle.zip</code> exists.';
            } else {
                $data['app_path'] = $path;

                $existingConfig = loadExistingInstallConfig($path . '/backend/.env');
                if ($existingConfig['detected']) {
                    $data['upgrade_detected'] = true;

                    if (empty($data['app_url']) && !empty($existingConfig['app_url'])) {
                        $data['app_url'] = $existingConfig['app_url'];
                    }
                    if (empty($data['app_name']) && !empty($existingConfig['app_name'])) {
                        $data['app_name'] = $existingConfig['app_name'];
                    }

                    $existingDb = $data['db'] ?? [];
                    $prefillDb = $existingConfig['db'] ?? [];
                    $data['db'] = [
                        'host' => (string)($existingDb['host'] ?? $prefillDb['host'] ?? 'localhost'),
                        'port' => (int)($existingDb['port'] ?? $prefillDb['port'] ?? 3306),
                        'name' => (string)($existingDb['name'] ?? $prefillDb['name'] ?? ''),
                        'user' => (string)($existingDb['user'] ?? $prefillDb['user'] ?? ''),
                        'pass' => (string)($existingDb['pass'] ?? $prefillDb['pass'] ?? ''),
                    ];
                } else {
                    $data['upgrade_detected'] = false;
                }

                saveData($data);
                advance(3);
            }
            break;

        // Step 3 → 4: test database connection
        case 3:
            $db = [
                'host' => trim($_POST['db_host'] ?? 'localhost'),
                'port' => (int)($_POST['db_port'] ?? 3306),
                'name' => trim($_POST['db_name'] ?? ''),
                'user' => trim($_POST['db_user'] ?? ''),
                'pass' => $_POST['db_pass'] ?? '',
            ];
            if (empty($db['name'])) $errors[] = 'Database name is required.';
            if (empty($db['user'])) $errors[] = 'Database username is required.';

            if (empty($errors)) {
                try {
                    $dsn = "mysql:host={$db['host']};port={$db['port']};dbname={$db['name']};charset=utf8mb4";
                    $pdo = new PDO($dsn, $db['user'], $db['pass'], [
                        PDO::ATTR_ERRMODE      => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_TIMEOUT      => 5,
                    ]);
                    unset($pdo);
                    $data['db'] = $db;
                    saveData($data);
                    advance(4);
                } catch (PDOException $e) {
                    $errors[] = 'Database connection failed: ' . htmlspecialchars($e->getMessage());
                }
            }
            break;

        // Step 4 → 5: application settings
        case 4:
            $appUrl  = rtrim(trim($_POST['app_url']  ?? ''), '/');
            $appName = trim($_POST['app_name'] ?? 'Memories Map');

            if (empty($appUrl)) {
                $errors[] = 'Application URL is required.';
            } elseif (!filter_var($appUrl, FILTER_VALIDATE_URL)) {
                $errors[] = 'Application URL must be a valid URL (e.g. <code>https://your-domain.com</code>).';
            }
            if (empty($appName)) {
                $errors[] = 'Application name is required.';
            }

            if (empty($errors)) {
                $data['app_url']  = $appUrl;
                $data['app_name'] = $appName;
                saveData($data);
                advance(5);
            }
            break;

        // Step 5 → 6: run installation
        case 5:
            $result = runInstall($data);
            if ($result['success']) {
                file_put_contents($lockFile, date('Y-m-d H:i:s') . "\n");
                $_SESSION['install_log']    = $result['log'];
                $_SESSION['install_notice'] = $result['notice'] ?? null;
                advance(6);
            } else {
                $errors = $result['errors'];
                $_SESSION['install_log'] = $result['log'] ?? [];
            }
            break;
    }
    $step = (int)($_SESSION['installer_step'] ?? $step ?? 1);
}

// ─────────────────────────── Page rendering ──────────────────────────────────

ob_start();

switch ($step) {
    case 1: renderStep1(); break;
    case 2: renderStep2($data, $errors); break;
    case 3: renderStep3($data, $errors); break;
    case 4: renderStep4($data, $errors); break;
    case 5: renderStep5($data, $errors); break;
    case 6: renderStep6(); break;
    default:
        $_SESSION['installer_step'] = 1;
        header('Location: ' . $_SERVER['PHP_SELF']);
        exit;
}

$content = ob_get_clean();
renderPage("Step $step of 6", $step, null, $content);

// ─────────────────────────── Step renderers ──────────────────────────────────

function renderStep1(): void
{
    $req = checkRequirements();
    echo '<h2 class="step-title">Welcome — Requirements Check</h2>';
    echo '<p class="step-desc">Memories Map needs the following to run. All checks must pass before you can continue.</p>';
    echo '<table class="req-table">';
    echo '<thead><tr><th>Requirement</th><th>Status</th><th>Details</th></tr></thead><tbody>';
    foreach ($req['items'] as $item) {
        $cls = $item['ok'] ? 'ok' : 'fail';
        $icon = $item['ok'] ? '✔' : '✘';
        echo "<tr class=\"req-{$cls}\"><td>" . htmlspecialchars($item['name']) . "</td>";
        echo "<td class=\"req-status\"><span class=\"badge badge-{$cls}\">{$icon}</span></td>";
        echo '<td>' . $item['detail'] . '</td></tr>';
    }
    echo '</tbody></table>';

    if (!$req['ok']) {
        echo '<div class="alert alert-error">Please fix the failed checks above, then reload this page.</div>';
        echo '<form method="post"><input type="hidden" name="step" value="1">
              <button type="submit" class="btn btn-primary">Re-check</button></form>';
    } else {
        echo '<div class="alert alert-success">All checks passed! You are ready to install.</div>';
        echo '<form method="post"><input type="hidden" name="step" value="1">
              <button type="submit" class="btn btn-primary">Continue →</button></form>';
    }
}

function renderStep2(array $data, array $errors): void
{
    // Try to guess a sensible default path from the installer's own location
    $guessBase = dirname(__DIR__); // one level up from public_html is often home dir
    $guess     = $guessBase . '/memories-map';

    echo '<h2 class="step-title">App Files Location</h2>';
    echo '<p class="step-desc">
        Enter the <strong>full server path</strong> to where you extracted the Memories Map release archive.
        This is typically somewhere like <code>/home/yourusername/memories-map</code>.
        You can find the path by browsing to the folder in cPanel File Manager and checking the address bar at the top.
    </p>';

    echo '<div class="alert alert-info">
        If this path already contains an existing installation, the installer will automatically prefill your current
        <code>.env</code> values on the next steps to make upgrades faster.
    </div>';

    renderErrors($errors);

    echo '<form method="post" class="form">';
    echo '<input type="hidden" name="step" value="2">';
    echo '<div class="form-group">';
    echo '<label for="app_path">Full server path to Memories Map</label>';
    $val = htmlspecialchars($data['app_path'] ?? $guess);
    echo '<input type="text" id="app_path" name="app_path" class="form-control" value="' . $val . '" required placeholder="/home/yourusername/memories-map">';
    echo '<small>Must contain a <code>backend/</code> subdirectory with <code>vendor/</code> inside it.</small>';
    echo '</div>';
    echo '<div class="wizard-actions">';
    echo '<a class="btn btn-secondary" href="?step=1">← Back</a>';
    echo '<button type="submit" class="btn btn-primary">Continue →</button>';
    echo '</div>';
    echo '</form>';
}

function renderStep3(array $data, array $errors): void
{
    echo '<h2 class="step-title">Database Setup</h2>';
    echo '<p class="step-desc">
        Create a MySQL database and user in cPanel (<em>MySQL Databases</em> section) before filling in these fields.
        The installer will verify the connection before proceeding.
    </p>';

    if (!empty($data['upgrade_detected'])) {
        echo '<div class="alert alert-success">Existing installation detected. Database fields were prefilled from your current <code>.env</code>.</div>';
    }

    renderErrors($errors);

    $db = $data['db'] ?? [];
    echo '<form method="post" class="form">';
    echo '<input type="hidden" name="step" value="3">';
    echo field('db_host', 'Database Host', $db['host'] ?? 'localhost', 'text', 'Usually <code>localhost</code> on shared hosting.');
    echo field('db_port', 'Database Port', (string)($db['port'] ?? '3306'), 'number');
    echo field('db_name', 'Database Name', $db['name'] ?? '', 'text', 'Created in cPanel → MySQL Databases.');
    echo field('db_user', 'Database Username', $db['user'] ?? '', 'text', 'Created in cPanel → MySQL Databases.');
    echo field('db_pass', 'Database Password', $db['pass'] ?? '', 'password');
    echo '<div class="wizard-actions">';
    echo '<a class="btn btn-secondary" href="?step=2">← Back</a>';
    echo '<button type="submit" class="btn btn-primary">Test Connection &amp; Continue →</button>';
    echo '</div>';
    echo '</form>';
}

function renderStep4(array $data, array $errors): void
{
    $guessUrl = (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' ? 'https' : 'http')
        . '://' . ($_SERVER['HTTP_HOST'] ?? 'your-domain.com');

    echo '<h2 class="step-title">Application Settings</h2>';
    echo '<p class="step-desc">Basic configuration for your Memories Map site.</p>';

    if (!empty($data['upgrade_detected'])) {
        echo '<div class="alert alert-success">Existing installation detected. App settings were prefilled from your current <code>.env</code>.</div>';
    }

    renderErrors($errors);

    echo '<form method="post" class="form">';
    echo '<input type="hidden" name="step" value="4">';
    echo field('app_url',  'Application URL',  $data['app_url']  ?? $guessUrl,        'url',  'The full URL of your site, without a trailing slash. This is used for links in emails and API responses.');
    echo field('app_name', 'Application Name', $data['app_name'] ?? 'Memories Map', 'text', 'Displayed in the browser tab and emails.');
    echo '<div class="wizard-actions">';
    echo '<a class="btn btn-secondary" href="?step=3">← Back</a>';
    echo '<button type="submit" class="btn btn-primary">Continue →</button>';
    echo '</div>';
    echo '</form>';
}

function renderStep5(array $data, array $errors): void
{
    echo '<h2 class="step-title">Review &amp; Install</h2>';
    echo '<p class="step-desc">Everything looks good. Review the summary below, then click <strong>Install</strong> to begin.</p>';

    renderErrors($errors);

    // Show log from a failed previous attempt
    $prevLog = $_SESSION['install_log'] ?? [];
    if (!empty($prevLog) && !empty($errors)) {
        echo '<details class="log-details"><summary>Installation log (previous attempt)</summary><pre>';
        foreach ($prevLog as $line) echo htmlspecialchars($line) . "\n";
        echo '</pre></details>';
    }

    $appPath = (string)($data['app_path'] ?? '');
    $appUrl = (string)($data['app_url'] ?? '');
    $appName = (string)($data['app_name'] ?? 'Memories Map');

    $dbRaw = is_array($data['db'] ?? null) ? $data['db'] : [];
    $db = [
        'host' => (string)($dbRaw['host'] ?? 'localhost'),
        'port' => (int)($dbRaw['port'] ?? 3306),
        'name' => (string)($dbRaw['name'] ?? ''),
        'user' => (string)($dbRaw['user'] ?? ''),
    ];

    if ($appPath === '' || $appUrl === '' || $db['name'] === '' || $db['user'] === '') {
        echo '<div class="alert alert-error">Some installer values are missing. Please go back and complete each step, then return to this page.</div>';
    }

    echo '<div class="review-box">';
    echo '<dl>';
    echo '<dt>App path</dt><dd>' . htmlspecialchars($appPath) . '</dd>';
    echo '<dt>App URL</dt><dd>' . htmlspecialchars($appUrl) . '</dd>';
    echo '<dt>App name</dt><dd>' . htmlspecialchars($appName) . '</dd>';
    echo '<dt>Database host</dt><dd>' . htmlspecialchars($db['host']) . ':' . (int)$db['port'] . '</dd>';
    echo '<dt>Database name</dt><dd>' . htmlspecialchars($db['name']) . '</dd>';
    echo '<dt>Database user</dt><dd>' . htmlspecialchars($db['user']) . '</dd>';
    echo '</dl></div>';

    echo '<div class="alert alert-info">
        The installer will:
        <ul>
            <li>Write the <code>.env</code> configuration file</li>
            <li>Generate a secure application key</li>
            <li>Run database migrations</li>
            <li>Seed default color themes</li>
            <li>Create storage directories</li>
            <li>Publish the frontend to your <code>public_html</code></li>
        </ul>
        <strong>This may take up to 60 seconds.</strong> Do not navigate away.
    </div>';

    echo '<form method="post" class="form">';
    echo '<input type="hidden" name="step" value="5">';
    echo '<div class="wizard-actions">';
    echo '<a class="btn btn-secondary" href="?step=4">← Back</a>';
    echo '<button type="submit" class="btn btn-primary btn-large">⚡ Install Now</button>';
    echo '</div>';
    echo '</form>';
}

function renderStep6(): void
{
    $log    = $_SESSION['install_log']    ?? [];
    $notice = $_SESSION['install_notice'] ?? null;
    $appUrl = (string)($_SESSION['installer_data']['app_url'] ?? '');
    $adminUrl = $appUrl !== '' ? rtrim($appUrl, '/') . '/admin' : '/admin';

    echo '<h2 class="step-title" style="color:#059669;">✔ Installation Complete!</h2>';
    echo '<p class="step-desc">Memories Map has been successfully installed and configured.</p>';

    if ($notice) {
        echo '<div class="alert alert-info">' . $notice . '</div>';
    }

    echo '<div class="alert alert-error" style="border-color:#dc2626;">
        <strong>Security Action Required:</strong> Delete the installer files from your
        <code>public_html</code> immediately using cPanel File Manager:
        <ul style="margin:8px 0 0">
            <li><code>memories-map-installer.php</code></li>
            <li><code>memories-map-installer.lock</code></li>
        </ul>
    </div>';

    echo '<div class="next-steps">';
    echo '<h3>Next Steps</h3>';
    echo '<ol>';
    echo '<li>Delete the installer files listed above.</li>';
    echo '<li><a href="' . htmlspecialchars($appUrl) . '" target="_blank">Open your site →</a> and create your first account.</li>';
    echo '<li><a href="' . htmlspecialchars($adminUrl) . '" target="_blank">Visit the Admin Console →</a> to configure mail delivery and other settings.<br>
               <em>Default credentials — Username: <code>MemoriesAdmin</code> &nbsp; Password: <code>WeC4nRemember!tForYouWh0le$al3</code> — change these immediately.</em></li>';
    echo '</ol></div>';

    echo '<details class="log-details"><summary>Installation log</summary><pre>';
    foreach ($log as $line) echo htmlspecialchars($line) . "\n";
    echo '</pre></details>';
}

// ─────────────────────────── Installation logic ──────────────────────────────

function runInstall(array $data): array
{
    $resolvedAppPath = resolveApplicationPath($data['app_path'] ?? '');
    if (!$resolvedAppPath) {
        return [
            'success' => false,
            'errors'  => ['Could not resolve the application path. Re-run the installer and choose the directory containing the Memories Map package.'],
            'log'     => [],
        ];
    }

    $db = $data['db'] ?? null;
    if (!is_array($db) || ($db['name'] ?? '') === '' || ($db['user'] ?? '') === '') {
        return [
            'success' => false,
            'errors'  => ['Installer data is incomplete (database settings are missing). Please go back to Step 3 and continue again.'],
            'log'     => [],
        ];
    }

    if ((string)($data['app_url'] ?? '') === '' || (string)($data['app_name'] ?? '') === '') {
        return [
            'success' => false,
            'errors'  => ['Installer data is incomplete (application settings are missing). Please go back to Step 4 and continue again.'],
            'log'     => [],
        ];
    }

    $backendDir  = $resolvedAppPath . '/backend';
    $publicHtml  = __DIR__;
    $log         = [];
    $errors      = [];
    $notice      = null;

    try {
        $permissionWarnings = applySharedHostingPermissions($resolvedAppPath, $backendDir, $publicHtml);
        foreach ($permissionWarnings as $warning) {
            $log[] = 'Warning: ' . $warning;
        }

        if (!hasCriticalVendorFiles($backendDir)) {
            $restored = restoreVendorFromBundle($resolvedAppPath, $backendDir, $log);
            if ($restored) {
                $permissionWarnings = applySharedHostingPermissions($resolvedAppPath, $backendDir, $publicHtml);
                foreach ($permissionWarnings as $warning) {
                    $log[] = 'Warning: ' . $warning;
                }
            }
        }

        $criticalVendorFiles = [
            $backendDir . '/vendor/autoload.php',
            $backendDir . '/vendor/symfony/deprecation-contracts/function.php',
        ];

        foreach ($criticalVendorFiles as $criticalVendorFile) {
            if (!file_exists($criticalVendorFile)) {
                throw new RuntimeException(
                    'Vendor installation is incomplete. Re-upload and re-extract the latest with-vendor release archive, then try the installer again.'
                );
            }
        }

        // 1. Reuse existing APP_KEY on upgrades to keep encrypted data readable.
        $existingEnvPath = $backendDir . '/.env';
        $existingAppKey = readExistingAppKey($existingEnvPath);

        if ($existingAppKey !== null) {
            $appKey = $existingAppKey;
            $log[] = 'Detected existing APP_KEY and reusing it for upgrade safety.';
        } else {
            $appKey = 'base64:' . base64_encode(random_bytes(32));
            $log[] = 'No existing APP_KEY found; generated a new key.';
        }

        // 2. Write .env
        $log[] = 'Writing .env file…';
        $existingEnv = parseDotEnvFile($existingEnvPath);
        $env   = buildEnv($data, $appKey, $existingEnv, $backendDir);
        if (file_put_contents($backendDir . '/.env', $env) === false) {
            throw new RuntimeException('Could not write .env to ' . $backendDir . '. Check that the directory is writable.');
        }
        $log[] = '.env written successfully.';

        // 3. Clear bootstrap cache
        $log[] = 'Clearing bootstrap cache…';
        foreach (glob($backendDir . '/bootstrap/cache/*.php') ?: [] as $f) {
            @unlink($f);
        }

        // 4. Bootstrap Laravel and run artisan commands
        $log[] = 'Bootstrapping Laravel application…';
        require_once $backendDir . '/vendor/autoload.php';

        $originalCwd = getcwd();
        chdir($backendDir);

        /** @var \Illuminate\Foundation\Application $app */
        $app    = require $backendDir . '/bootstrap/app.php';
        $kernel = $app->make(\Illuminate\Contracts\Console\Kernel::class);

        $log[] = 'Running database migrations…';
        $exitCode = $kernel->call('migrate', ['--force' => true]);
        if ($exitCode !== 0) {
            throw new RuntimeException('Migrations failed with exit code ' . $exitCode . '. Check your database credentials.');
        }
        $log[] = 'Migrations complete.';

        $log[] = 'Seeding default color themes…';
        $exitCode = $kernel->call('db:seed', ['--class' => 'ColorThemeSeeder', '--force' => true]);
        if ($exitCode !== 0) {
            $log[] = 'Warning: Seeder returned exit code ' . $exitCode . '. Themes may already exist, continuing.';
        } else {
            $log[] = 'Seeder complete.';
        }

        $kernel->terminate(request(), 0);
        chdir($originalCwd);

        // 5. Ensure storage directories exist and are writable
        $log[] = 'Creating storage directories…';
        $dirs = [
            $backendDir . '/storage/framework/cache/data',
            $backendDir . '/storage/framework/sessions',
            $backendDir . '/storage/framework/views',
            $backendDir . '/storage/logs',
            $backendDir . '/storage/app/public',
        ];

        $effectiveEnv = parseDotEnvFile($backendDir . '/.env');
        $mediaStoragePath = (string)($effectiveEnv['MEDIA_STORAGE_PATH'] ?? ($backendDir . '/storage/app/private/media'));
        $mediaStoragePath = rtrim($mediaStoragePath, '/\\');
        if ($mediaStoragePath !== '') {
            $dirs[] = $mediaStoragePath;
            $dirs[] = $mediaStoragePath . '/thumbnails';
        }

        foreach ($dirs as $dir) {
            if (!is_dir($dir) && !mkdir($dir, 0755, true)) {
                $log[] = 'Warning: could not create ' . $dir;
            }
        }

        // 6. Publish compiled frontend assets to public_html
        $log[] = 'Publishing frontend assets to public_html…';
        $published = publishToPublicHtml($backendDir, $publicHtml, $resolvedAppPath);
        if ($published['errors']) {
            foreach ($published['errors'] as $e) $log[] = 'Warning: ' . $e;
        }
        $log[] = 'Published ' . $published['count'] . ' file(s) to public_html.';

        $publishedFrontendIndex = $publicHtml . '/index.html';
        $backendFrontendIndex = $backendDir . '/public/index.html';
        if (!file_exists($publishedFrontendIndex) && !file_exists($backendFrontendIndex)) {
            throw new RuntimeException(
                'Frontend build files were not found after publish. Re-upload a release package that includes backend/public/index.html and retry the installer.'
            );
        }

        $permissionWarnings = applySharedHostingPermissions($resolvedAppPath, $backendDir, $publicHtml);
        foreach ($permissionWarnings as $warning) {
            $log[] = 'Warning: ' . $warning;
        }

        // 7. Write public_html/index.php
        $log[] = 'Writing public_html/index.php…';
        writePublicIndex($publicHtml, $backendDir);
        $log[] = 'index.php written.';

        // Copy .htaccess if missing
        $htaccessSrc = $backendDir . '/public/.htaccess';
        $htaccessDst = $publicHtml . '/.htaccess';
        if (file_exists($htaccessSrc) && !file_exists($htaccessDst)) {
            copy($htaccessSrc, $htaccessDst);
            $log[] = '.htaccess copied.';
        }

        $runtimeFileErrors = verifyInstalledRuntimeFiles($backendDir, $publicHtml);
        if (!empty($runtimeFileErrors)) {
            foreach ($runtimeFileErrors as $runtimeFileError) {
                $log[] = 'Missing required file: ' . $runtimeFileError;
            }

            throw new RuntimeException('Installation is incomplete. One or more required runtime files are missing.');
        }

        $log[] = 'Installation finished successfully.';
        return ['success' => true, 'log' => $log, 'notice' => $notice];

    } catch (Throwable $e) {
        $errors[] = htmlspecialchars($e->getMessage());
        return ['success' => false, 'errors' => $errors, 'log' => $log];
    }
}

function buildEnv(array $data, string $appKey, array $existingEnv = [], string $backendDir = ''): string
{
    $db      = is_array($data['db'] ?? null) ? $data['db'] : [];
    $appUrl  = addslashes((string)($data['app_url'] ?? 'https://your-domain.com'));
    $appName = addslashes((string)($data['app_name'] ?? 'Memories Map'));
    $dbHost  = addslashes((string)($db['host'] ?? 'localhost'));
    $dbPort  = (int)($db['port'] ?? 3306);
    $dbName  = addslashes((string)($db['name'] ?? ''));
    $dbUser  = addslashes((string)($db['user'] ?? ''));
    $dbPass  = (string)($db['pass'] ?? ''); // Raw — written quoted below

    // Escape any double-quotes in the password for .env
    $dbPassEscaped = str_replace('"', '\\"', $dbPass);

    $defaultMediaPath = rtrim($backendDir, '/\\') !== ''
        ? rtrim($backendDir, '/\\') . '/storage/app/private/media'
        : '/var/memories-map/media';

    $mediaStoragePath = addslashes((string)($existingEnv['MEDIA_STORAGE_PATH'] ?? $defaultMediaPath));
    $mediaEncryptionEnabled = toEnvBoolean($existingEnv['MEDIA_ENCRYPTION_ENABLED'] ?? 'true');
    $mediaEncryptionKey = trim((string)($existingEnv['MEDIA_ENCRYPTION_KEY'] ?? ''));
    $maxUploadSizeMb = (int)($existingEnv['MAX_UPLOAD_SIZE_MB'] ?? 500);
    if ($maxUploadSizeMb <= 0) {
        $maxUploadSizeMb = 500;
    }

    $mediaEncryptionKeyLine = $mediaEncryptionKey !== ''
        ? 'MEDIA_ENCRYPTION_KEY=' . $mediaEncryptionKey
        : '# MEDIA_ENCRYPTION_KEY=';

    return <<<ENV
APP_NAME="{$appName}"
APP_ENV=production
APP_KEY={$appKey}
APP_DEBUG=false
APP_URL={$appUrl}

LOG_CHANNEL=stack
LOG_LEVEL=error

DB_CONNECTION=mysql
DB_HOST={$dbHost}
DB_PORT={$dbPort}
DB_DATABASE={$dbName}
DB_USERNAME={$dbUser}
DB_PASSWORD="{$dbPassEscaped}"

BROADCAST_DRIVER=log
CACHE_DRIVER=file
QUEUE_CONNECTION=sync
SESSION_DRIVER=file
SESSION_LIFETIME=120

MAIL_MAILER=log
MAIL_FROM_ADDRESS="no-reply@example.com"
MAIL_FROM_NAME="{$appName}"

FILESYSTEM_DISK=local
MEDIA_STORAGE_PATH="{$mediaStoragePath}"
MEDIA_ENCRYPTION_ENABLED={$mediaEncryptionEnabled}
{$mediaEncryptionKeyLine}
MAX_UPLOAD_SIZE_MB={$maxUploadSizeMb}
ENV;
}

function toEnvBoolean(mixed $value): string
{
    $normalized = strtolower(trim((string)$value));
    return in_array($normalized, ['1', 'true', 'yes', 'on'], true) ? 'true' : 'false';
}

function readExistingAppKey(string $envPath): ?string
{
    if (!file_exists($envPath) || !is_readable($envPath)) {
        return null;
    }

    $contents = @file_get_contents($envPath);
    if ($contents === false || $contents === '') {
        return null;
    }

    if (!preg_match('/^APP_KEY\s*=\s*(.+)$/m', $contents, $matches)) {
        return null;
    }

    $raw = trim($matches[1]);
    if ($raw === '') {
        return null;
    }

    if ((str_starts_with($raw, '"') && str_ends_with($raw, '"')) || (str_starts_with($raw, "'") && str_ends_with($raw, "'"))) {
        $raw = substr($raw, 1, -1);
    }

    return trim($raw) !== '' ? $raw : null;
}

function loadExistingInstallConfig(string $envPath): array
{
    $env = parseDotEnvFile($envPath);
    if (empty($env)) {
        return ['detected' => false];
    }

    $dbPort = isset($env['DB_PORT']) && is_numeric($env['DB_PORT']) ? (int) $env['DB_PORT'] : 3306;

    return [
        'detected' => true,
        'app_url' => (string)($env['APP_URL'] ?? ''),
        'app_name' => (string)($env['APP_NAME'] ?? ''),
        'db' => [
            'host' => (string)($env['DB_HOST'] ?? 'localhost'),
            'port' => $dbPort,
            'name' => (string)($env['DB_DATABASE'] ?? ''),
            'user' => (string)($env['DB_USERNAME'] ?? ''),
            'pass' => (string)($env['DB_PASSWORD'] ?? ''),
        ],
    ];
}

function parseDotEnvFile(string $envPath): array
{
    if (!file_exists($envPath) || !is_readable($envPath)) {
        return [];
    }

    $contents = @file_get_contents($envPath);
    if ($contents === false || $contents === '') {
        return [];
    }

    $values = [];
    $lines = preg_split('/\r\n|\r|\n/', $contents) ?: [];

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) {
            continue;
        }

        $pos = strpos($line, '=');
        if ($pos === false) {
            continue;
        }

        $key = trim(substr($line, 0, $pos));
        $value = trim(substr($line, $pos + 1));

        if ($key === '') {
            continue;
        }

        if ($value !== '' && ((str_starts_with($value, '"') && str_ends_with($value, '"')) || (str_starts_with($value, "'") && str_ends_with($value, "'")))) {
            $value = substr($value, 1, -1);
        }

        $value = str_replace(['\\"', "\\'", '\\\\'], ['"', "'", '\\'], $value);
        $values[$key] = $value;
    }

    return $values;
}

function publishToPublicHtml(string $backendDir, string $publicHtml, string $appRoot): array
{
    $srcDir = $backendDir . '/public';
    $count  = 0;
    $errors = [];

    if (!is_dir($srcDir)) {
        return ['count' => 0, 'errors' => ['backend/public directory not found — skipping asset copy.']];
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($srcDir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $item) {
        $subPath = $iterator->getSubPathname();
        // Skip the original index.php — we write our own
        if ($subPath === 'index.php') continue;

        $dest = $publicHtml . DIRECTORY_SEPARATOR . $subPath;

        if ($item->isDir()) {
            if (!is_dir($dest) && !mkdir($dest, 0755, true)) {
                $errors[] = 'Could not create directory: ' . $dest;
            }
        } else {
            if (!copy($item->getRealPath(), $dest)) {
                $errors[] = 'Could not copy: ' . $subPath;
            } else {
                $count++;
            }
        }
    }

    return ['count' => $count, 'errors' => $errors];
}

function writePublicIndex(string $publicHtml, string $backendDir): void
{
    // Use the real absolute path so the index.php always works regardless of cwd
    $backendDir = realpath($backendDir) ?: $backendDir;
    $backendDir = addslashes($backendDir);

    $content = <<<PHP
<?php
use Illuminate\Http\Request;
define('LARAVEL_START', microtime(true));
\$_backendDir = '{$backendDir}';
if (file_exists(\$_backendDir . '/storage/framework/maintenance.php')) {
    require \$_backendDir . '/storage/framework/maintenance.php';
}
require \$_backendDir . '/vendor/autoload.php';
(require_once \$_backendDir . '/bootstrap/app.php')->handleRequest(Request::capture());
PHP;

    file_put_contents($publicHtml . '/index.php', $content);
}

function verifyInstalledRuntimeFiles(string $backendDir, string $publicHtml): array
{
    $requiredPaths = [
        $backendDir . '/vendor/autoload.php',
        $backendDir . '/bootstrap/app.php',
        $backendDir . '/public/index.html',
        $publicHtml . '/index.php',
        $publicHtml . '/index.html',
    ];

    $missing = [];
    foreach ($requiredPaths as $requiredPath) {
        if (!file_exists($requiredPath)) {
            $missing[] = $requiredPath;
        }
    }

    $publicAssetsPath = $publicHtml . '/assets';
    if (!is_dir($publicAssetsPath)) {
        $missing[] = $publicAssetsPath;
    }

    return $missing;
}

// ─────────────────────────── Requirements check ──────────────────────────────

function checkRequirements(): array
{
    $items = [];
    $ok    = true;

    // PHP version
    $phpOk = version_compare(PHP_VERSION, '8.2.0', '>=');
    $items[] = [
        'name'   => 'PHP Version',
        'ok'     => $phpOk,
        'detail' => 'Detected: ' . PHP_VERSION . ' (8.2+ required)',
    ];
    if (!$phpOk) $ok = false;

    // Required extensions
    foreach (['pdo', 'pdo_mysql', 'mbstring', 'openssl', 'tokenizer', 'xml', 'ctype', 'json', 'bcmath', 'fileinfo', 'gd'] as $ext) {
        $extOk  = extension_loaded($ext);
        $items[] = [
            'name'   => "PHP extension: $ext",
            'ok'     => $extOk,
            'detail' => $extOk ? 'Loaded' : '<strong>Missing</strong> — contact your hosting provider.',
        ];
        if (!$extOk) $ok = false;
    }

    // Recommended extension (non-blocking)
    $exifOk = extension_loaded('exif');
    $items[] = [
        'name'   => 'PHP extension: exif (recommended)',
        'ok'     => true,
        'detail' => $exifOk
            ? 'Loaded'
            : 'Not loaded. Uploads still work, but EXIF-based duplicate checks and metadata extraction are limited.',
    ];

    // Upload limits visibility (non-blocking)
    $uploadMax = (string) ini_get('upload_max_filesize');
    $postMax = (string) ini_get('post_max_size');
    $items[] = [
        'name'   => 'PHP upload limits',
        'ok'     => true,
        'detail' => 'upload_max_filesize=' . htmlspecialchars($uploadMax) . ', post_max_size=' . htmlspecialchars($postMax),
    ];

    // Write permission in public_html
    $writable = is_writable(__DIR__);
    $items[] = [
        'name'   => 'public_html is writable',
        'ok'     => $writable,
        'detail' => $writable ? 'Writable' : '<strong>Not writable</strong> — the installer cannot publish files.',
    ];
    if (!$writable) $ok = false;

    // Sessions
    $sessOk = function_exists('session_start');
    $items[] = [
        'name'   => 'PHP sessions',
        'ok'     => $sessOk,
        'detail' => $sessOk ? 'Available' : '<strong>Unavailable</strong>',
    ];
    if (!$sessOk) $ok = false;

    return ['ok' => $ok, 'items' => $items];
}

function resolveApplicationPath(string $inputPath): ?string
{
    $path = rtrim(trim($inputPath), '/\\');
    $path = realpath($path) ?: $path;

    if ($path && is_dir($path)) {
        if (is_dir($path . '/backend') && file_exists($path . '/backend/artisan')) {
            return $path;
        }

        $nested = $path . '/memories-map';
        $nested = realpath($nested) ?: $nested;
        if ($nested && is_dir($nested) && is_dir($nested . '/backend') && file_exists($nested . '/backend/artisan')) {
            return $nested;
        }
    }

    return null;
}

function hasCriticalVendorFiles(string $backendDir): bool
{
    return file_exists($backendDir . '/vendor/autoload.php')
        && file_exists($backendDir . '/vendor/symfony/deprecation-contracts/function.php');
}

function restoreVendorFromBundle(string $appRoot, string $backendDir, array &$log): bool
{
    $bundlePath = $appRoot . '/deploy/cpanel/vendor.bundle.zip';
    if (!file_exists($bundlePath)) {
        $log[] = 'Vendor recovery bundle was not found at deploy/cpanel/vendor.bundle.zip.';
        return false;
    }

    if (!class_exists('ZipArchive')) {
        $log[] = 'PHP ZipArchive extension is not available, so vendor recovery could not run.';
        return false;
    }

    if (!is_dir($backendDir) && !mkdir($backendDir, 0755, true)) {
        $log[] = 'Could not create backend directory before vendor recovery.';
        return false;
    }

    $zip = new ZipArchive();
    if ($zip->open($bundlePath) !== true) {
        $log[] = 'Could not open vendor recovery bundle: ' . $bundlePath;
        return false;
    }

    $ok = $zip->extractTo($backendDir);
    $zip->close();

    if (!$ok) {
        $log[] = 'Failed to extract vendor recovery bundle into backend directory.';
        return false;
    }

    if (hasCriticalVendorFiles($backendDir)) {
        $log[] = 'Recovered backend/vendor from deploy/cpanel/vendor.bundle.zip.';
        return true;
    }

    $log[] = 'Vendor recovery bundle extracted, but critical vendor files are still missing.';
    return false;
}

function applySharedHostingPermissions(string $appRoot, string $backendDir, string $publicHtml): array
{
    $warnings = [];

    $roots = [
        $appRoot,
        $backendDir,
        $publicHtml,
    ];

    foreach ($roots as $root) {
        if (!is_dir($root)) {
            continue;
        }

        if (!@chmod($root, 0755)) {
            $warnings[] = 'Could not set directory permissions on ' . $root . ' (expected 755).';
        }

        $iterator = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );

        foreach ($iterator as $item) {
            $path = $item->getPathname();
            if ($item->isDir()) {
                if (!@chmod($path, 0755)) {
                    $warnings[] = 'Could not set directory permissions on ' . $path . ' (expected 755).';
                }
            } else {
                if (!@chmod($path, 0644)) {
                    $warnings[] = 'Could not set file permissions on ' . $path . ' (expected 644).';
                }
            }
        }
    }

    return $warnings;
}

// ─────────────────────────── Utilities ───────────────────────────────────────

function advance(int $step): void
{
    $_SESSION['installer_step'] = $step;
}

function saveData(array $data): void
{
    $_SESSION['installer_data'] = $data;
}

function field(string $name, string $label, string $value, string $type = 'text', string $hint = ''): string
{
    $id  = htmlspecialchars($name);
    $lbl = htmlspecialchars($label);
    $val = htmlspecialchars($value);
    $tp  = htmlspecialchars($type);
    $h   = $hint ? "<small>{$hint}</small>" : '';
    return <<<HTML
<div class="form-group">
    <label for="{$id}">{$lbl}</label>
    <input type="{$tp}" id="{$id}" name="{$id}" class="form-control" value="{$val}">
    {$h}
</div>
HTML;
}

function renderErrors(array $errors): void
{
    if (empty($errors)) return;
    echo '<div class="alert alert-error"><strong>Please fix the following:</strong><ul>';
    foreach ($errors as $e) echo '<li>' . $e . '</li>';
    echo '</ul></div>';
}

// ─────────────────────────── HTML shell ──────────────────────────────────────

function renderPage(string $title, int $step, ?string $subtitle, string $body = ''): void
{
    $totalSteps = 6;
    $pct        = ($step / $totalSteps) * 100;
    $stepLabels = ['Requirements', 'App Location', 'Database', 'Settings', 'Install', 'Complete'];
    ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="robots" content="noindex,nofollow">
    <title>Memories Map Installer – <?= htmlspecialchars($title) ?></title>
    <style>
        /* ── Reset & base ── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { font-size: 16px; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f0f4f8;
            color: #1a1f2e;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem 1rem;
        }
        /* ── Layout ── */
        .installer-wrap {
            width: 100%;
            max-width: 700px;
        }
        .installer-header {
            text-align: center;
            margin-bottom: 1.5rem;
        }
        .installer-header h1 {
            font-size: 1.75rem;
            font-weight: 700;
            color: #0d7377;
        }
        .installer-header .version {
            font-size: 0.85rem;
            color: #4a5568;
            margin-top: 0.25rem;
        }
        /* ── Progress bar ── */
        .progress-wrap { margin-bottom: 1.5rem; }
        .progress-steps {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.5rem;
        }
        .progress-step {
            font-size: 0.72rem;
            color: #4a5568;
            text-align: center;
            flex: 1;
        }
        .progress-step.active { color: #0d7377; font-weight: 700; }
        .progress-step.done   { color: #059669; }
        .progress-bar-bg {
            height: 6px;
            background: #d1d5db;
            border-radius: 3px;
            overflow: hidden;
        }
        .progress-bar-fill {
            height: 100%;
            background: #0d7377;
            border-radius: 3px;
            transition: width 0.4s;
        }
        /* ── Card ── */
        .card {
            background: #fff;
            border-radius: 10px;
            box-shadow: 0 2px 12px rgba(0,0,0,.1);
            padding: 2rem;
        }
        /* ── Step content ── */
        .step-title {
            font-size: 1.25rem;
            font-weight: 700;
            margin-bottom: 0.5rem;
            color: #1a1f2e;
        }
        .step-desc {
            color: #4a5568;
            margin-bottom: 1.25rem;
            line-height: 1.6;
        }
        /* ── Forms ── */
        .form-group {
            margin-bottom: 1.25rem;
        }
        .form-group label {
            display: block;
            font-weight: 600;
            margin-bottom: 0.35rem;
            font-size: 0.9rem;
        }
        .form-control {
            width: 100%;
            padding: 0.55rem 0.75rem;
            border: 2px solid #d1d5db;
            border-radius: 6px;
            font-size: 0.95rem;
            color: #1a1f2e;
            background: #fff;
            transition: border-color 0.2s;
        }
        .form-control:focus {
            outline: none;
            border-color: #0d7377;
            box-shadow: 0 0 0 3px rgba(13,115,119,.15);
        }
        .form-group small {
            display: block;
            margin-top: 0.3rem;
            font-size: 0.8rem;
            color: #4a5568;
        }
        /* ── Buttons ── */
        .btn {
            display: inline-block;
            padding: 0.6rem 1.5rem;
            border: none;
            border-radius: 6px;
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            text-decoration: none;
            transition: background 0.2s, transform 0.1s;
        }
        .btn:active { transform: scale(0.98); }
        .btn-primary { background: #0d7377; color: #fff; }
        .btn-primary:hover { background: #0b5f63; }
        .btn-secondary { background: #e2e8f0; color: #1a1f2e; }
        .btn-secondary:hover { background: #cbd5e1; }
        .btn-large { padding: 0.8rem 2rem; font-size: 1.05rem; }
        .wizard-actions {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 0.75rem;
            margin-top: 0.75rem;
        }
        /* ── Alerts ── */
        .alert {
            border-radius: 6px;
            padding: 0.9rem 1rem;
            margin-bottom: 1.25rem;
            border-left: 4px solid;
            font-size: 0.9rem;
            line-height: 1.6;
        }
        .alert ul { margin: 0.5rem 0 0 1.2rem; }
        .alert-error   { background: #fef2f2; border-color: #dc2626; color: #1a1f2e; }
        .alert-success { background: #f0fdf4; border-color: #059669; color: #1a1f2e; }
        .alert-info    { background: #eff6ff; border-color: #0d7377; color: #1a1f2e; }
        /* ── Requirements table ── */
        .req-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.875rem;
            margin-bottom: 1.25rem;
        }
        .req-table th {
            text-align: left;
            padding: 0.5rem 0.75rem;
            background: #f8fafc;
            border-bottom: 2px solid #e2e8f0;
            font-weight: 700;
            color: #1a1f2e;
        }
        .req-table td { padding: 0.45rem 0.75rem; border-bottom: 1px solid #e2e8f0; }
        .req-ok  td { background: #f0fdf4; }
        .req-fail td { background: #fef2f2; }
        .req-status { text-align: center; }
        .badge { font-size: 0.9rem; font-weight: 700; }
        .badge-ok   { color: #059669; }
        .badge-fail { color: #dc2626; }
        /* ── Review box ── */
        .review-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 1rem 1.25rem;
            margin-bottom: 1.25rem;
        }
        .review-box dl { display: grid; grid-template-columns: 1fr 2fr; gap: 0.4rem 1rem; font-size: 0.875rem; }
        .review-box dt { font-weight: 700; color: #4a5568; }
        .review-box dd { color: #1a1f2e; word-break: break-all; }
        /* ── Next steps ── */
        .next-steps {
            background: #f8fafc;
            border: 1px solid #d1d5db;
            border-radius: 6px;
            padding: 1rem 1.25rem;
            margin-bottom: 1.25rem;
        }
        .next-steps h3 { margin-bottom: 0.5rem; font-size: 1rem; }
        .next-steps ol { margin-left: 1.2rem; line-height: 2; font-size: 0.9rem; }
        .next-steps a { color: #0d7377; font-weight: 600; }
        /* ── Log ── */
        .log-details { margin-top: 1rem; }
        .log-details summary { cursor: pointer; font-size: 0.85rem; color: #4a5568; margin-bottom: 0.4rem; }
        .log-details pre {
            background: #1a1f2e;
            color: #a8d8a8;
            padding: 1rem;
            border-radius: 6px;
            font-size: 0.8rem;
            overflow-x: auto;
            white-space: pre-wrap;
            word-break: break-all;
        }
        /* ── Footer ── */
        .installer-footer {
            text-align: center;
            margin-top: 1.25rem;
            font-size: 0.8rem;
            color: #4a5568;
        }
        code { background: #f1f5f9; padding: 0.1em 0.35em; border-radius: 3px; font-size: 0.875em; }
    </style>
</head>
<body>
<div class="installer-wrap">

    <div class="installer-header">
        <h1>🗺 Memories Map — Installer</h1>
        <div class="version">Version <?= INSTALLER_VERSION ?></div>
    </div>

    <div class="progress-wrap">
        <div class="progress-steps">
            <?php foreach ($stepLabels as $i => $lbl): ?>
                <?php
                    $n = $i + 1;
                    $cls = $n < $step ? 'done' : ($n === $step ? 'active' : '');
                ?>
                <div class="progress-step <?= $cls ?>"><?= htmlspecialchars($lbl) ?></div>
            <?php endforeach; ?>
        </div>
        <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width:<?= $pct ?>%"></div>
        </div>
    </div>

    <div class="card">
        <?= $body ?>
    </div>

    <div class="installer-footer">
        Memories Map Web Installer <?= INSTALLER_VERSION ?> &mdash;
        <a href="https://github.com/" style="color:#0d7377">GitHub</a>
    </div>

</div>
</body>
</html>
    <?php
}

$stepLabels = ['Requirements', 'App Location', 'Database', 'Settings', 'Install', 'Complete'];
// (end of file)
