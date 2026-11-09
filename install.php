<?php
// Run once in the browser: install.php — then DELETE this file from the server.
require __DIR__ . '/db.php';
header('Content-Type: text/plain; charset=utf-8');

$sql = file_get_contents(__DIR__ . '/schema.sql');
$sql = preg_replace('/^\s*--.*$/m', '', $sql);
$pdo = pdo();
foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
    $pdo->exec($stmt);
}
echo "Database ready. Delete install.php from the server now.\n";
