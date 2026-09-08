<?php
header("Access-Control-Allow-Origin:*");//解决跨域请求问题
header('Access-Control-Allow-Methods:POST');
header('Access-Control-Allow-Headers:x-requested-with, content-type');  
header("content-Type: text/html; charset=utf-8");//字符编码设置  
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
$sql = "SELECT id,content palavra FROM test order by time desc limit 10"; 
$result = $conn->query($sql); 
if (mysqli_num_rows($result) < 1){
	echo '[{"id":"1","palavra":"欢迎"}]';
}else{
	$arr = array();  
	// 输出每行数据  
	while($row = $result->fetch_assoc()) {  
		$count=count($row);//不能在循环语句中，由于每次删除row数组长度都减小  
		for($i=0;$i<$count;$i++){  
			unset($row[$i]);//删除冗余数据  
		}  
		array_push($arr,$row);  
	}  
	echo json_encode($arr);
};
$conn->close();  
?>