<?php
require __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function num($v) { return ($v === '' || $v === null || !is_numeric($v)) ? null : (float)$v; }
function str($v, int $max) { return mb_substr((string)($v ?? ''), 0, $max); }
function out($v) { return $v === null ? '' : (string)(0 + $v); }

try {
    $pdo = pdo();

    if ($_SERVER['REQUEST_METHOD'] === 'GET') {
        $apts = $pdo->query('SELECT * FROM apartments ORDER BY sort, id')->fetchAll();
        $rooms = $pdo->query('SELECT * FROM rooms ORDER BY sort')->fetchAll();
        $items = $pdo->query('SELECT * FROM items ORDER BY sort')->fetchAll();
        $opts = $pdo->query('SELECT * FROM options ORDER BY sort')->fetchAll();

        $byItem = [];
        foreach ($opts as $o) {
            $byItem[$o['item_id']][] = [
                'id' => $o['id'], 'name' => $o['name'], 'price' => out($o['price']), 'store' => $o['store'],
                'dims' => $o['dims'], 'url' => $o['url'], 'img' => $o['img'] ?? '', 'notes' => $o['notes'] ?? '',
                'fav' => (bool)$o['fav'],
            ];
        }
        $byRoom = [];
        foreach ($items as $i) {
            $byRoom[$i['room_id']][] = [
                'id' => $i['id'], 'name' => $i['name'], 'qty' => (int)$i['qty'], 'priority' => $i['priority'],
                'status' => $i['status'], 'options' => $byItem[$i['id']] ?? [],
            ];
        }
        $byApt = [];
        foreach ($rooms as $r) {
            $byApt[$r['apartment_id']][] = [
                'id' => $r['id'], 'name' => $r['name'], 'budget' => out($r['budget']), 'items' => $byRoom[$r['id']] ?? [],
            ];
        }
        $res = [];
        foreach ($apts as $a) {
            $res[] = ['id' => $a['id'], 'name' => $a['name'], 'budget' => out($a['budget']), 'rooms' => $byApt[$a['id']] ?? []];
        }
        echo json_encode(['apartments' => $res, 'canEdit' => key_ok()], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        if (!key_ok()) { http_response_code(403); echo json_encode(['error' => 'bad key']); exit; }
        $d = json_decode(file_get_contents('php://input'), true);
        if (!is_array($d) || !isset($d['apartments']) || !is_array($d['apartments'])) {
            http_response_code(400); echo json_encode(['error' => 'bad json']); exit;
        }

        $pdo->beginTransaction();
        $pdo->exec('DELETE FROM rooms'); // cascades to items and options
        $updApt = $pdo->prepare('UPDATE apartments SET budget = ? WHERE id = ?');
        $insRoom = $pdo->prepare('INSERT INTO rooms (id, apartment_id, name, budget, sort) VALUES (?,?,?,?,?)');
        $insItem = $pdo->prepare('INSERT INTO items (id, room_id, name, qty, priority, status, sort) VALUES (?,?,?,?,?,?,?)');
        $insOpt = $pdo->prepare('INSERT INTO options (id, item_id, name, price, store, dims, url, img, notes, fav, sort) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
        $known = $pdo->query('SELECT id FROM apartments')->fetchAll(PDO::FETCH_COLUMN);
        $seen = [];
        $uniq = function ($id) use (&$seen) {
            $id = preg_replace('/[^A-Za-z0-9_-]/', '', (string)$id) ?: bin2hex(random_bytes(4));
            $id = substr($id, 0, 32);
            while (isset($seen[$id])) $id = bin2hex(random_bytes(4));
            return $seen[$id] = $id;
        };

        foreach ($d['apartments'] as $a) {
            if (!in_array($a['id'] ?? '', $known, true)) continue;
            $updApt->execute([num($a['budget'] ?? null), $a['id']]);
            foreach (($a['rooms'] ?? []) as $ri => $r) {
                $rid = $uniq($r['id'] ?? '');
                $insRoom->execute([$rid, $a['id'], str($r['name'] ?? '', 100), num($r['budget'] ?? null), $ri]);
                foreach (($r['items'] ?? []) as $ii => $i) {
                    $iid = $uniq($i['id'] ?? '');
                    $insItem->execute([$iid, $rid, str($i['name'] ?? '', 150), max(1, (int)($i['qty'] ?? 1)),
                        str($i['priority'] ?? 'Medium', 10), str($i['status'] ?? 'Researching', 20), $ii]);
                    foreach (($i['options'] ?? []) as $oi => $o) {
                        $insOpt->execute([$uniq($o['id'] ?? ''), $iid, str($o['name'] ?? '', 200), num($o['price'] ?? null),
                            str($o['store'] ?? '', 150), str($o['dims'] ?? '', 150), str($o['url'] ?? '', 1000),
                            str($o['img'] ?? '', 3000000), str($o['notes'] ?? '', 20000), !empty($o['fav']) ? 1 : 0, $oi]);
                    }
                }
            }
        }
        $pdo->commit();
        echo json_encode(['ok' => true]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['error' => 'method']);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['error' => 'server error']);
}
