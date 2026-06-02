<?php

declare(strict_types=1);

namespace Tests\Feature;

use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Tests\TestCase;

final class FrontendEntrypointFallbackFeatureTest extends TestCase
{
    public function test_login_route_serves_installer_published_index_when_backend_public_index_is_missing(): void
    {
        $baseDir = storage_path('framework/testing/frontend-entrypoint-' . uniqid('', true));
        $fallbackPublicDir = $baseDir . '/public_html';
        $emptyBackendPublicDir = $baseDir . '/backend-public';

        mkdir($fallbackPublicDir, 0755, true);
        mkdir($emptyBackendPublicDir, 0755, true);

        $fallbackIndex = $fallbackPublicDir . '/index.html';
        file_put_contents($fallbackIndex, '<!doctype html><title>Installer Published Frontend</title>');

        $originalPublicPath = $this->app->publicPath();
        $originalScriptFilename = $_SERVER['SCRIPT_FILENAME'] ?? null;
        $originalDocumentRoot = $_SERVER['DOCUMENT_ROOT'] ?? null;

        $this->app->usePublicPath($emptyBackendPublicDir);
        $_SERVER['SCRIPT_FILENAME'] = $fallbackPublicDir . '/index.php';
        $_SERVER['DOCUMENT_ROOT'] = $fallbackPublicDir;

        try {
            $response = $this->get('/login');

            $response->assertOk();
            $this->assertInstanceOf(BinaryFileResponse::class, $response->baseResponse);
            $this->assertSame(realpath($fallbackIndex), $response->baseResponse->getFile()->getRealPath());
        } finally {
            $this->app->usePublicPath($originalPublicPath);

            if ($originalScriptFilename === null) {
                unset($_SERVER['SCRIPT_FILENAME']);
            } else {
                $_SERVER['SCRIPT_FILENAME'] = $originalScriptFilename;
            }

            if ($originalDocumentRoot === null) {
                unset($_SERVER['DOCUMENT_ROOT']);
            } else {
                $_SERVER['DOCUMENT_ROOT'] = $originalDocumentRoot;
            }

            @unlink($fallbackIndex);
            @rmdir($fallbackPublicDir);
            @rmdir($emptyBackendPublicDir);
            @rmdir($baseDir . '/backend-public');
            @rmdir($baseDir);
        }
    }
}