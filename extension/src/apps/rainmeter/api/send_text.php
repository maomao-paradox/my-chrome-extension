<?php
header("Access-Control-Allow-Origin:*");//解决跨域请求问题
header('Access-Control-Allow-Methods:POST');
header('Access-Control-Allow-Headers:x-requested-with, content-type');  
header("content-Type: application/x-www-form-urlencoded; multipart/form-data; text/html; charset=utf-8");//字符编码设置  
// print_r($_POST["text"]);

$servername = "localhost";  
//数据库账号
$username = "root";  
//数据库密码
$password = "123456";  
//数据库名
$dbname = "wzy";  
  
// 创建连接  
$conn =mysqli_connect($servername,$username,$password,$dbname);  
// 检测连接  
if(mysqli_connect_errno($conn)) {
	die("Connect failed: " . $conn->connect_error());
} 
//连接数据库表  
$sql = "insert into test(content,time) value('$_POST[text]','$_POST[time]')"; 
// print_r($sql);
$result = $conn->query($sql);  

echo $result;
$conn->close();  
?>