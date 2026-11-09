<?php
// Run once in the browser: install.php?key=YOUR_EDIT_KEY  — then DELETE this file from the server.
require __DIR__ . '/db.php';
header('Content-Type: text/plain; charset=utf-8');
if (!key_ok()) { http_response_code(403); exit("Forbidden: add ?key=<edit_key>\n"); }

$sql = file_get_contents(__DIR__ . '/schema.sql');
$sql = preg_replace('/^\s*--.*$/m', '', $sql);
$pdo = pdo();
foreach (array_filter(array_map('trim', explode(';', $sql))) as $stmt) {
    $pdo->exec($stmt);
}
echo "Database ready. Delete install.php from the server now.\n";
