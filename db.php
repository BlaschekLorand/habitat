<?php
function cfg(): array {
    static $c = null;
    if ($c === null) {
        $f = __DIR__ . '/config.php';
        if (!is_file($f)) { http_response_code(500); exit('config.php missing'); }
        $c = require $f;
    }
    return $c;
}

function pdo(): PDO {
    $c = cfg();
    return new PDO(
        "mysql:host={$c['db_host']};dbname={$c['db_name']};charset=utf8mb4",
        $c['db_user'], $c['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
}
